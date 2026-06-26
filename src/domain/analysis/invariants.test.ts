import { describe, expect, it } from "vitest";
import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import { Invariants } from "@/domain/analysis/invariants";
import type { Invariant } from "@/domain/analysis/types";
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

const matrix = (net: PetriNet): IncidenceMatrix => new IncidenceMatrix(net);

/** Compare invariant sets irrespective of order: weight records sorted by a stable key. */
const sortWeights = (records: Record<string, number>[]): Record<string, number>[] =>
  [...records].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const weights = (invariants: Invariant[]): Record<string, number>[] =>
  sortWeights(invariants.map((i) => i.weights));

/** Ring of `n` places and `n` transitions: p1→t1→p2→…→pn→tn→p1. Both state machine & marked graph. */
const ring = (n: number): PetriNet => {
  const places = Array.from({ length: n }, (_, i) => place(`p${i + 1}`, i === 0 ? 1 : 0));
  const transitions = Array.from({ length: n }, (_, i) => transition(`t${i + 1}`));
  const arcs: Arc[] = [];
  for (let i = 0; i < n; i++) {
    arcs.push(arc(`p${i + 1}`, `t${i + 1}`));
    arcs.push(arc(`t${i + 1}`, `p${((i + 1) % n) + 1}`));
  }
  return { places, transitions, arcs };
};

describe("Invariants", () => {
  describe("placeInvariants", () => {
    it("returns the all-ones P-invariant for a state-machine ring", () => {
      const m = matrix(ring(3));
      expect(weights(Invariants.placeInvariants(m))).toEqual([{ p1: 1, p2: 1, p3: 1 }]);
    });

    it("derives non-unit weights from arc multiplicities (2·pA ⇌ pB)", () => {
      // pA --2--> t1 --> pB ; pB --> t2 --2--> pA : conserves pA + 2·pB.
      const net: PetriNet = {
        places: [place("pA", 2), place("pB")],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("pA", "t1", 2), arc("t1", "pB"), arc("pB", "t2"), arc("t2", "pA", 2)],
      };
      expect(weights(Invariants.placeInvariants(matrix(net)))).toEqual([{ pA: 1, pB: 2 }]);
    });

    it("keeps only minimal supports — two disjoint cycles give two invariants, not their sum", () => {
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
          arc("p4", "t4"),
          arc("t4", "p3"),
        ],
      };
      expect(weights(Invariants.placeInvariants(matrix(net)))).toEqual([
        { p1: 1, p2: 1 },
        { p3: 1, p4: 1 },
      ]);
    });

    it("finds no P-invariant for an unbounded producer (source transition)", () => {
      const net: PetriNet = {
        places: [place("p1")],
        transitions: [transition("t0")],
        arcs: [arc("t0", "p1")],
      };
      expect(Invariants.placeInvariants(matrix(net))).toEqual([]);
    });

    it("treats each place as its own invariant when the net has no arcs", () => {
      const net: PetriNet = {
        places: [place("p1"), place("p2")],
        transitions: [transition("t1")],
        arcs: [],
      };
      expect(weights(Invariants.placeInvariants(matrix(net)))).toEqual([{ p1: 1 }, { p2: 1 }]);
    });

    it("returns nothing for the empty net", () => {
      expect(Invariants.placeInvariants(matrix({ places: [], transitions: [], arcs: [] }))).toEqual(
        [],
      );
    });
  });

  describe("transitionInvariants", () => {
    it("returns the all-ones T-invariant for a marked-graph ring", () => {
      const m = matrix(ring(3));
      expect(weights(Invariants.transitionInvariants(m))).toEqual([{ t1: 1, t2: 1, t3: 1 }]);
    });

    it("finds no T-invariant for an unbounded producer", () => {
      const net: PetriNet = {
        places: [place("p1")],
        transitions: [transition("t0")],
        arcs: [arc("t0", "p1")],
      };
      expect(Invariants.transitionInvariants(matrix(net))).toEqual([]);
    });
  });

  describe("covers", () => {
    it("reports full place & transition coverage for a conservative, consistent net", () => {
      const m = matrix(ring(3));
      expect(Invariants.covers(Invariants.placeInvariants(m), m.places)).toBe(true);
      expect(Invariants.covers(Invariants.transitionInvariants(m), m.transitions)).toBe(true);
    });

    it("reports no coverage when an element lies in no invariant", () => {
      const net: PetriNet = {
        places: [place("p1")],
        transitions: [transition("t0")],
        arcs: [arc("t0", "p1")],
      };
      const m = matrix(net);
      expect(Invariants.covers(Invariants.placeInvariants(m), m.places)).toBe(false);
      expect(Invariants.covers(Invariants.transitionInvariants(m), m.transitions)).toBe(false);
    });

    it("is vacuously true over no ids", () => {
      expect(Invariants.covers([], [])).toBe(true);
    });
  });
});
