import { describe, expect, it } from "vitest";
import { PetriNetEngine } from "@/domain/engine";
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

describe("PetriNetEngine", () => {
  describe("initialMarking", () => {
    it("reads each place's tokens as M0", () => {
      const net: PetriNet = { places: [place("p1", 3), place("p2", 0)], transitions: [], arcs: [] };
      expect(PetriNetEngine.initialMarking(net)).toEqual({ p1: 3, p2: 0 });
    });
  });

  describe("isEnabled", () => {
    // p1 --(weight)--> t1 --> p2
    const build = (tokens: number, weight = 1): PetriNetEngine =>
      new PetriNetEngine({
        places: [place("p1", tokens), place("p2")],
        transitions: [transition("t1")],
        arcs: [arc("p1", "t1", weight), arc("t1", "p2")],
      });

    it("is enabled when the input place meets the arc weight", () => {
      expect(build(1).isEnabled("t1", { p1: 1, p2: 0 })).toBe(true);
    });

    it("is not enabled when tokens are below the arc weight", () => {
      expect(build(0).isEnabled("t1", { p1: 0, p2: 0 })).toBe(false);
    });

    it("respects weights > 1 at the boundary", () => {
      const engine = build(0, 3);
      expect(engine.isEnabled("t1", { p1: 2 })).toBe(false);
      expect(engine.isEnabled("t1", { p1: 3 })).toBe(true);
    });

    it("requires every input place to satisfy its arc (AND semantics)", () => {
      const engine = new PetriNetEngine({
        places: [place("p1", 1), place("p2", 0)],
        transitions: [transition("t1")],
        arcs: [arc("p1", "t1"), arc("p2", "t1")],
      });
      expect(engine.isEnabled("t1", { p1: 1, p2: 0 })).toBe(false);
      expect(engine.isEnabled("t1", { p1: 1, p2: 1 })).toBe(true);
    });

    it("treats a source transition (no input arcs) as always enabled", () => {
      const engine = new PetriNetEngine({
        places: [place("p1")],
        transitions: [transition("t1")],
        arcs: [arc("t1", "p1")],
      });
      expect(engine.isEnabled("t1", {})).toBe(true);
    });

    it("returns false for an unknown transition id", () => {
      expect(build(5).isEnabled("nope", { p1: 5 })).toBe(false);
    });
  });

  describe("enabledTransitions", () => {
    it("returns exactly the enabled transition ids", () => {
      const engine = new PetriNetEngine({
        places: [place("p1", 1), place("p2", 0)],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("p1", "t1"), arc("p2", "t2")],
      });
      expect(engine.enabledTransitions({ p1: 1, p2: 0 })).toEqual(["t1"]);
    });
  });

  describe("fire", () => {
    const engine = new PetriNetEngine({
      places: [place("p1", 3), place("p2", 0)],
      transitions: [transition("t1")],
      arcs: [arc("p1", "t1", 2), arc("t1", "p2", 1)],
    });

    it("consumes input weight and produces output weight in a new marking", () => {
      expect(engine.fire("t1", { p1: 3, p2: 0 })).toEqual({ p1: 1, p2: 1 });
    });

    it("does not mutate the input marking (pure)", () => {
      const m0 = { p1: 3, p2: 0 };
      engine.fire("t1", m0);
      expect(m0).toEqual({ p1: 3, p2: 0 });
    });

    it("throws when the transition is not enabled", () => {
      expect(() => engine.fire("t1", { p1: 1, p2: 0 })).toThrow(/not enabled/);
    });

    it("throws for an unknown transition id", () => {
      expect(() => engine.fire("nope", { p1: 3 })).toThrow();
    });

    it("handles multiple inputs and outputs with weights", () => {
      const multi = new PetriNetEngine({
        places: [place("p1", 2), place("p2", 2), place("p3", 0), place("p4", 0)],
        transitions: [transition("t1")],
        arcs: [arc("p1", "t1", 2), arc("p2", "t1", 1), arc("t1", "p3", 3), arc("t1", "p4", 1)],
      });
      expect(multi.fire("t1", { p1: 2, p2: 2, p3: 0, p4: 0 })).toEqual({
        p1: 0,
        p2: 1,
        p3: 3,
        p4: 1,
      });
    });
  });
});
