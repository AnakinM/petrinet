import { describe, expect, it } from "vitest";
import { ReachabilityGraph } from "@/domain/analysis/reachabilityGraph";
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

/** One token bouncing p1↔p2: bounded, safe, live, reversible, deadlock-free. */
const bounceNet = (): PetriNet => ({
  places: [place("p1", 1), place("p2", 0)],
  transitions: [transition("t1"), transition("t2")],
  arcs: [arc("p1", "t1"), arc("t1", "p2"), arc("p2", "t2"), arc("t2", "p1")],
});

describe("ReachabilityGraph", () => {
  describe("a bounded, live, reversible net (token bouncing p1<->p2)", () => {
    const g = new ReachabilityGraph(bounceNet());

    it("explores exactly the two reachable markings, completely", () => {
      expect(g.states).toBe(2);
      expect(g.exceeded).toBe(false);
      expect(g.unbounded).toBe(false);
      expect(g.complete).toBe(true);
    });

    it("reports the exact bound and safeness", () => {
      expect(g.bound()).toBe(1);
      expect(g.isBounded()).toBe("yes");
      expect(g.isSafe()).toBe("yes");
    });

    it("is live, reversible, deadlock-free and quasi-live", () => {
      expect(g.isLive()).toBe("yes");
      expect(g.isReversible()).toBe("yes");
      expect(g.isDeadlockFree()).toBe("yes");
      expect(g.isQuasiLive()).toBe("yes");
      expect(g.deadlocks()).toEqual([]);
      expect(g.deadTransitions()).toEqual([]);
    });
  });

  describe("an unbounded producer (a source transition pumping p1)", () => {
    // t1 has no input place, so it is always enabled and adds a token to p1 each firing.
    const net: PetriNet = {
      places: [place("p1", 0)],
      transitions: [transition("t1")],
      arcs: [arc("t1", "p1")],
    };
    const g = new ReachabilityGraph(net);

    it("detects unboundedness via ancestor-covering and stops that branch", () => {
      expect(g.unbounded).toBe(true);
      expect(g.isBounded()).toBe("no");
      expect(g.isSafe()).toBe("no");
      expect(g.bound()).toBeNull();
    });

    it("leaves every completeness-dependent verdict indeterminate", () => {
      expect(g.complete).toBe(false);
      expect(g.isLive()).toBe("indeterminate");
      expect(g.isReversible()).toBe("indeterminate");
      expect(g.isDeadlockFree()).toBe("indeterminate");
      expect(g.isQuasiLive()).toBe("indeterminate");
      expect(g.deadTransitions()).toEqual([]);
    });
  });

  describe("a net that runs into a deadlock (p1 -> t1 -> p2 -> t2 -> p3 sink)", () => {
    const net: PetriNet = {
      places: [place("p1", 1), place("p2", 0), place("p3", 0)],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("p1", "t1"), arc("t1", "p2"), arc("p2", "t2"), arc("t2", "p3")],
    };
    const g = new ReachabilityGraph(net);

    it("reports the dead marking with a firing path from M0", () => {
      expect(g.deadlocks()).toEqual([{ marking: { p1: 0, p2: 0, p3: 1 }, path: ["t1", "t2"] }]);
      expect(g.isDeadlockFree()).toBe("no");
    });

    it("is bounded and safe but neither live nor reversible", () => {
      expect(g.complete).toBe(true);
      expect(g.bound()).toBe(1);
      expect(g.isSafe()).toBe("yes");
      expect(g.isLive()).toBe("no");
      expect(g.isReversible()).toBe("no");
    });
  });

  describe("a net with a structurally dead transition (t3 starved of tokens)", () => {
    // t1/t2 cycle one token p1<->p2; t3 needs p3 which never holds a token.
    const net: PetriNet = {
      places: [place("p1", 1), place("p2", 0), place("p3", 0)],
      transitions: [transition("t1"), transition("t2"), transition("t3")],
      arcs: [arc("p1", "t1"), arc("t1", "p2"), arc("p2", "t2"), arc("t2", "p1"), arc("p3", "t3")],
    };
    const g = new ReachabilityGraph(net);

    it("names the transition that never fires", () => {
      expect(g.deadTransitions()).toEqual(["t3"]);
      expect(g.isQuasiLive()).toBe("no");
    });

    it("is not live (t3 can never fire) yet stays reversible and deadlock-free", () => {
      expect(g.isLive()).toBe("no");
      expect(g.isReversible()).toBe("yes");
      expect(g.isDeadlockFree()).toBe("yes");
    });
  });

  describe("hitting the state cap", () => {
    const g = new ReachabilityGraph(bounceNet(), 1);

    it("stops at the cap and renders every behavioural verdict indeterminate", () => {
      expect(g.exceeded).toBe(true);
      expect(g.complete).toBe(false);
      expect(g.states).toBe(1);
      expect(g.bound()).toBeNull();
      expect(g.isBounded()).toBe("indeterminate");
      expect(g.isSafe()).toBe("indeterminate");
      expect(g.isLive()).toBe("indeterminate");
      expect(g.isReversible()).toBe("indeterminate");
      expect(g.isDeadlockFree()).toBe("indeterminate");
    });

    it("does not flag a capped net as unbounded", () => {
      expect(g.unbounded).toBe(false);
    });
  });

  describe("an exactly-cap-sized net is still complete", () => {
    it("treats the cap as inclusive (no spurious exceeded)", () => {
      const g = new ReachabilityGraph(bounceNet(), 2);
      expect(g.exceeded).toBe(false);
      expect(g.complete).toBe(true);
      expect(g.states).toBe(2);
    });
  });

  describe("the empty net", () => {
    it("explores its single marking without throwing", () => {
      const g = new ReachabilityGraph({ places: [], transitions: [], arcs: [] });
      expect(g.states).toBe(1);
      expect(g.exceeded).toBe(false);
      expect(g.unbounded).toBe(false);
      expect(g.bound()).toBe(0);
    });
  });

  describe("a net with places but no transitions", () => {
    it("is dead, not live — never both at once", () => {
      const g = new ReachabilityGraph({ places: [place("p1", 1)], transitions: [], arcs: [] });
      // Nothing can ever fire, so its sole marking is a deadlock; liveness must not read "yes".
      expect(g.isDeadlockFree()).toBe("no");
      expect(g.isLive()).toBe("no");
    });
  });
});
