import { beforeEach, describe, expect, it } from "vitest";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { useSimStore } from "@/store/simStore";

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

// p1(2) --2--> t1 --1--> p2
const net = (): PetriNet => ({
  places: [place("p1", 2), place("p2", 0)],
  transitions: [transition("t1")],
  arcs: [arc("p1", "t1", 2), arc("t1", "p2", 1)],
});

const sim = (): ReturnType<typeof useSimStore.getState> => useSimStore.getState();

describe("simStore", () => {
  beforeEach(() => sim().stop());

  describe("start", () => {
    it("snapshots M0 and computes the enabled set", () => {
      sim().start(net());
      expect(sim().marking).toEqual({ p1: 2, p2: 0 });
      expect([...sim().enabled]).toEqual(["t1"]);
    });
  });

  describe("fire", () => {
    it("advances the marking and recomputes enabledness", () => {
      sim().start(net());
      sim().fire("t1");
      expect(sim().marking).toEqual({ p1: 0, p2: 1 });
      expect([...sim().enabled]).toEqual([]); // p1 below the arc weight of 2
    });

    it("ignores a disabled transition without changing the marking", () => {
      sim().start(net());
      sim().fire("t1"); // p1 -> 0, t1 now disabled
      const before = sim().marking;
      sim().fire("t1");
      expect(sim().marking).toBe(before);
    });

    it("ignores an unknown id", () => {
      sim().start(net());
      const before = sim().marking;
      sim().fire("nope");
      expect(sim().marking).toBe(before);
    });
  });

  describe("spawnToken", () => {
    it("adds tokens and re-enables transitions", () => {
      sim().start(net());
      sim().fire("t1"); // p1 -> 0
      sim().spawnToken("p1", 2);
      expect(sim().marking.p1).toBe(2);
      expect([...sim().enabled]).toEqual(["t1"]);
    });

    it("clamps at zero", () => {
      sim().start(net());
      sim().spawnToken("p1", -5);
      expect(sim().marking.p1).toBe(0);
    });
  });

  describe("reset", () => {
    it("restores the captured M0", () => {
      sim().start(net());
      sim().fire("t1");
      sim().reset();
      expect(sim().marking).toEqual({ p1: 2, p2: 0 });
      expect([...sim().enabled]).toEqual(["t1"]);
    });
  });

  describe("stop", () => {
    it("clears the working copy and makes firing a no-op", () => {
      sim().start(net());
      sim().stop();
      expect(sim().marking).toEqual({});
      expect([...sim().enabled]).toEqual([]);
      sim().fire("t1"); // no engine bound -> no-op, no throw
      expect(sim().marking).toEqual({});
    });
  });
});
