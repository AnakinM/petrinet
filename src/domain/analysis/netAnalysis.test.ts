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

  it("degrades conservative and structural boundedness to indeterminate when invariants truncate", () => {
    // Two disjoint cycles need two minimal P-semiflows; the tiny cap can't hold them, so the
    // enumeration truncates and coverage is unknown — verdicts must not claim a false negative.
    const net: PetriNet = {
      places: [place("p1", 1), place("p2"), place("p3", 1), place("p4")],
      transitions: ["t1", "t2", "t3", "t4"].map(transition),
      arcs: [
        arc("p1", "t1"),
        arc("t1", "p2"),
        arc("p2", "t2"),
        arc("t2", "p1"),
        arc("p3", "t3"),
        arc("t3", "p4"),
        arc("t4", "p3"),
        arc("p4", "t4"),
      ],
    };
    const r = NetAnalysis.analyze(net, { invariantCap: 1 });

    expect(r.invariants.placeTruncated).toBe(true);
    expect(r.invariants.place).toEqual([]);
    expect(r.conservative.verdict).toBe("indeterminate");
    expect(r.boundedness.bounded).toBe("indeterminate");
    expect(r.boundedness.source).toBe("none");
  });

  it("keeps conservative definite when only the transition-invariant family truncates", () => {
    // One place, two self-loop transitions: P stays covered (so conservative is decidable) while
    // the T-family overruns the cap — a T-overflow must not drag conservative to indeterminate.
    const net: PetriNet = {
      places: [place("p", 1)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("p", "t1"), arc("t1", "p"), arc("p", "t2"), arc("t2", "p")],
    };
    const r = NetAnalysis.analyze(net, { invariantCap: 1 });

    expect(r.invariants.placeTruncated).toBe(false);
    expect(r.invariants.transitionTruncated).toBe(true);
    expect(r.conservative.verdict).toBe("yes");
  });

  it("fills the structural diagnostics even without the behavioural pass", () => {
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
    };
    const r = NetAnalysis.analyze(net);
    // structural (net-graph) facts are algebraic-cheap, so they resolve in the live slice…
    expect(r.diagnostics.cyclicComponents).toEqual([["P1", "P2", "t1", "t2"]]);
    expect(r.diagnostics.connected).toBe(true);
    // …while the behavioural witnesses stay empty until reachability runs.
    expect(r.diagnostics.deadTransitions).toEqual([]);
    expect(r.diagnostics.deadlocks).toEqual([]);
  });
});

describe("NetAnalysis.analyze (behavioural slice)", () => {
  it("settles a bounded conservative cycle as safe, live, reversible and deadlock-free", () => {
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
    };
    const r = NetAnalysis.analyze(net, { behavioral: true });

    expect(r.boundedness.bounded).toBe("yes");
    expect(r.boundedness.source).toBe("structural");
    expect(r.boundedness.bound).toBe(1);
    expect(r.boundedness.safe).toBe("yes");
    expect(r.live.verdict).toBe("yes");
    expect(r.reversible.verdict).toBe("yes");
    expect(r.deadlockFree.verdict).toBe("yes");
    expect(r.quasiLive.verdict).toBe("yes");
    expect(r.exploredStates).toBe(2);
    expect(r.stateSpaceExceeded).toBe(false);
    expect(r.stateSpaceComplete).toBe(true);
  });

  it("reports an unbounded producer via reachability, not the structural cover", () => {
    const net: PetriNet = {
      places: [place("P1", 0)],
      transitions: [transition("t1")],
      arcs: [arc("t1", "P1")],
    };
    const r = NetAnalysis.analyze(net, { behavioral: true });

    expect(r.boundedness.bounded).toBe("no");
    expect(r.boundedness.source).toBe("reachability");
    expect(r.boundedness.bound).toBeNull();
    expect(r.live.verdict).toBe("indeterminate");
    expect(r.live.detail).toContain("unbounded");
    expect(r.stateSpaceComplete).toBe(false); // an unbounded graph is never complete
  });

  it("names the dead marking and its path when the net deadlocks", () => {
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0), place("P3", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P3")],
    };
    const r = NetAnalysis.analyze(net, { behavioral: true });

    expect(r.deadlockFree.verdict).toBe("no");
    expect(r.deadlockFree.detail).toContain("P3=1");
    expect(r.diagnostics.deadlocks).toEqual([
      { marking: { P1: 0, P2: 0, P3: 1 }, path: ["t1", "t2"] },
    ]);
    expect(r.live.verdict).toBe("no");
  });

  it("names a structurally dead transition as non-quasi-live", () => {
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0), place("P3", 0)],
      transitions: [transition("t1"), transition("t2"), transition("starved")],
      arcs: [
        arc("P1", "t1"),
        arc("t1", "P2"),
        arc("P2", "t2"),
        arc("t2", "P1"),
        arc("P3", "starved"),
      ],
    };
    const r = NetAnalysis.analyze(net, { behavioral: true });

    expect(r.quasiLive.verdict).toBe("no");
    expect(r.quasiLive.detail).toContain("starved");
    expect(r.diagnostics.deadTransitions).toEqual(["starved"]);
  });

  it("keeps structural boundedness but leaves k unknown when the state cap is hit", () => {
    // A structurally bounded cycle, but the (tiny) cap stops the pass before k can be settled.
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
    };
    const r = NetAnalysis.analyze(net, { behavioral: true, cap: 1 });

    expect(r.boundedness.bounded).toBe("yes"); // the structural P-cover still proves it
    expect(r.boundedness.source).toBe("structural");
    expect(r.boundedness.bound).toBeNull(); // …but the exact k is unknown
    expect(r.boundedness.safe).toBe("indeterminate");
    expect(r.stateSpaceExceeded).toBe(true);
    expect(r.stateSpaceComplete).toBe(false); // capped ⇒ empty diagnostics are not definitive
    expect(r.live.detail).toContain("cap");
  });
});

describe("NetAnalysis.behavioral", () => {
  it("threading a cached algebraic slice equals a full one-shot behavioural analyze", () => {
    // Re-analyze augments the live algebraic result instead of recomputing it; the two paths must
    // agree byte-for-byte, otherwise threading would silently drift from the one-shot analysis.
    const net: PetriNet = {
      places: [place("P1", 1), place("P2", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
    };
    const oneShot = NetAnalysis.analyze(net, { behavioral: true });
    const threaded = NetAnalysis.behavioral(net, NetAnalysis.analyze(net));
    expect(threaded).toEqual(oneShot);
  });
});

describe("NetAnalysis.signature", () => {
  const base: PetriNet = {
    places: [place("P1", 1), place("P2", 0)],
    transitions: [transition("t1")],
    arcs: [arc("P1", "t1", 2)],
  };

  it("is unchanged by a position-only edit (which cannot affect any verdict)", () => {
    const moved: PetriNet = {
      ...base,
      places: [{ ...base.places[0], position: { x: 999, y: 999 } }, base.places[1]],
    };
    expect(NetAnalysis.signature(moved)).toBe(NetAnalysis.signature(base));
  });

  it("changes when tokens (M0) or arc multiplicity change", () => {
    const moreTokens: PetriNet = {
      ...base,
      places: [{ ...base.places[0], tokens: 5 }, base.places[1]],
    };
    const heavierArc: PetriNet = { ...base, arcs: [arc("P1", "t1", 3)] };
    expect(NetAnalysis.signature(moreTokens)).not.toBe(NetAnalysis.signature(base));
    expect(NetAnalysis.signature(heavierArc)).not.toBe(NetAnalysis.signature(base));
  });

  it("stays injective when ids contain fingerprint delimiters (crafted imports)", () => {
    // A delimiter-joined fingerprint collides here ('x:1,y' + tokens 0 vs 'x'+1, 'y'+0 → "x:1,y:0");
    // the JSON encoding keeps two structurally different nets apart.
    const a: PetriNet = { places: [place("x:1,y", 0)], transitions: [], arcs: [] };
    const b: PetriNet = { places: [place("x", 1), place("y", 0)], transitions: [], arcs: [] };
    expect(NetAnalysis.signature(a)).not.toBe(NetAnalysis.signature(b));
  });
});
