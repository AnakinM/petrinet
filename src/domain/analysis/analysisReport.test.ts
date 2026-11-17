import { describe, expect, it } from "vitest";
import { AnalysisReport } from "@/domain/analysis/analysisReport";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string, tokens = 0): Place => ({
  id,
  name: id,
  tokens,
  position: { x: 0, y: 0 },
});
const transition = (id: string): Transition => ({ id, name: id, position: { x: 0, y: 0 } });
const arc = (source: string, target: string, multiplicity = 1): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity,
  points: [],
});

const net: PetriNet = {
  places: [place("P1", 1), place("P2")],
  transitions: [transition("T1"), transition("T2")],
  arcs: [arc("P1", "T1"), arc("T1", "P2"), arc("P2", "T2"), arc("T2", "P1")],
};

describe("AnalysisReport", () => {
  it("reports a full analysis with every section and the name Analysis", () => {
    const text = AnalysisReport.build(net, NetAnalysis.analyze(net, { behavioral: true }), {
      stale: false,
    });
    expect(text.startsWith("Analysis\n")).toBe(true);
    expect(text).not.toMatch(/analytics/i);
    expect(text).toContain("Analysis is up to date. Explored 2 markings.");
    expect(text).toContain("Live: Yes.");
    expect(text).toContain("State machine: Yes.");
    expect(text).toContain("Place invariants: 1");
    expect(text).toContain("  - P1 + P2");
    expect(text).toContain("P1: 1\nP2: 1");
    expect(text).toContain("Incidence matrix\n\tT1\tT2\nP1\t-1\t1\nP2\t1\t-1");
    expect(text).not.toContain("out of date");
    expect(text).not.toMatch(/Re-analyze/);
  });

  it("says when the full analysis has not run", () => {
    const text = AnalysisReport.build(net, NetAnalysis.analyze(net), { stale: false });
    expect(text).toContain("Some results need the full analysis.");
    expect(text).toContain("Live: Unknown. Needs the full analysis.");
    expect(text).toContain("Place bounds\nNeeds the full analysis.");
    expect(text).not.toMatch(/Re-analyze|out of date/);
  });

  it("says when the results are out of date", () => {
    const text = AnalysisReport.build(net, NetAnalysis.analyze(net), { stale: true });
    expect(text).toContain(
      "The net changed after the last full analysis. The results may be out of date.",
    );
    expect(text).not.toContain("Some results need the full analysis.");
  });

  it("says when the state space was capped and marks bounds as lower limits", () => {
    const text = AnalysisReport.build(net, NetAnalysis.analyze(net, { behavioral: true, cap: 1 }), {
      stale: false,
    });
    expect(text).toContain(
      "Analysis is up to date. Explored 1 marking. The state space exceeded the 10,000-marking cap.",
    );
    expect(text).toContain("Lower limits only");
    expect(text).toContain("P1: at least 1");
  });

  it("prints no bound for an unbounded place and unknown for a missing one", () => {
    const pump: PetriNet = {
      places: [place("P1")],
      transitions: [transition("T1")],
      arcs: [arc("T1", "P1")],
    };
    const text = AnalysisReport.build(pump, NetAnalysis.analyze(pump, { behavioral: true }), {
      stale: false,
    });
    expect(text).toContain("P1: no bound (unbounded)");
    expect(text).toContain("The net is unbounded, so its reachability graph is infinite.");
    // A lone unbounded place leaves no other place whose number could be too low.
    expect(text).not.toContain("Other places may grow");
    const withSecond: PetriNet = { ...pump, places: [place("P1"), place("P2", 1)] };
    const second = AnalysisReport.build(
      withSecond,
      NetAnalysis.analyze(withSecond, { behavioral: true }),
      { stale: false },
    );
    expect(second).toContain(
      "The analysis stopped when it proved the net unbounded. Other places may grow without limit too.",
    );
    const full = NetAnalysis.analyze(net, { behavioral: true });
    const missing = { ...full, placeBounds: { max: {}, exact: true, unbounded: [] } };
    expect(AnalysisReport.build(net, missing, { stale: false })).toContain("P1: unknown");
  });

  it("explains a heavy arc in the class reasons", () => {
    const heavy: PetriNet = { ...net, arcs: [arc("P1", "T1", 2), ...net.arcs.slice(1)] };
    const text = AnalysisReport.build(heavy, NetAnalysis.analyze(heavy), { stale: false });
    expect(text).toContain(
      "State machine: No. The shape fits a state machine, but 1 arc has a weight above 1.",
    );
  });
});
