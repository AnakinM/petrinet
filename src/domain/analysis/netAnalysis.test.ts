import { describe, expect, it } from "vitest";
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

describe("NetAnalysis.analyze (algebraic slice)", () => {
  it("finds a strictly conservative cycle as bounded & conservative with covering invariants", () => {
    // One token shuttles P1 ⇄ P2 through t1/t2; total token count is constant.
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
    };
    const r = NetAnalysis.analyze(net);

    expect(r.conservative.verdict).toBe("yes");
    expect(r.strictlyConservative).toBe(true);
    expect(r.boundedness.bounded).toBe("yes");
    expect(r.boundedness.source).toBe("structural");
    expect(r.boundedness.safe).toBe("indeterminate"); // exact k needs reachability
    expect(r.invariants.placesCovered).toBe(true);
    expect(r.invariants.transitionsCovered).toBe(true);
    // the conserved weighting spans both places (the all-ones P-semiflow P1 + P2)
    const support = new Set(r.invariants.place.flatMap((inv) => Object.keys(inv.weights)));
    expect(support).toEqual(new Set(["P1", "P2"]));
  });

  it("reports an uncovered producer as non-conservative with indeterminate boundedness", () => {
    // t1 endlessly produces into P1 with no consumer: unbounded, not conservative.
    const net: PetriNet = {
      places: [place("P1", 0)],
      transitions: [transition("t1")],
      arcs: [arc("t1", "P1")],
    };
    const r = NetAnalysis.analyze(net);

    expect(r.conservative.verdict).toBe("no");
    expect(r.strictlyConservative).toBe(false);
    expect(r.boundedness.bounded).toBe("indeterminate");
    expect(r.boundedness.source).toBe("none");
    expect(r.invariants.placesCovered).toBe(false);
    expect(r.invariants.place).toHaveLength(0);
    expect(r.invariants.transitionsCovered).toBe(false);
  });

  it("leaves every behavioural verdict indeterminate (no reachability pass yet)", () => {
    const net: PetriNet = {
      places: [place("P1", 1)],
      transitions: [transition("t1")],
      arcs: [arc("P1", "t1"), arc("t1", "P1")],
    };
    const r = NetAnalysis.analyze(net);

    expect(r.live.verdict).toBe("indeterminate");
    expect(r.quasiLive.verdict).toBe("indeterminate");
    expect(r.reversible.verdict).toBe("indeterminate");
    expect(r.deadlockFree.verdict).toBe("indeterminate");
    expect(r.stateSpaceExceeded).toBe(false);
    expect(r.exploredStates).toBe(0);
    expect(r.diagnostics.deadTransitions).toEqual([]);
    expect(r.diagnostics.deadlocks).toEqual([]);
  });

  it("handles the empty net without throwing", () => {
    const r = NetAnalysis.analyze({ places: [], transitions: [], arcs: [] });
    expect(r.invariants.place).toEqual([]);
    expect(r.invariants.transition).toEqual([]);
    expect(r.strictlyConservative).toBe(false);
    expect(r.exploredStates).toBe(0);
  });
});
