import { describe, expect, it } from "vitest";
import { SimHistory } from "@/domain/simHistory";
import type { Marking } from "@/domain/types";

const m0: Marking = { p1: 1, p2: 0 };
const m1: Marking = { p1: 0, p2: 1 };
const m2: Marking = { p1: 0, p2: 0, p3: 1 };

describe("SimHistory", () => {
  describe("init", () => {
    it("starts at M0 with no steps and the cursor before the first step", () => {
      expect(SimHistory.init(m0)).toEqual({ m0, steps: [], cursor: -1 });
    });
  });

  describe("record", () => {
    it("appends a step and advances the cursor onto it", () => {
      const h = SimHistory.record(SimHistory.init(m0), "t1", m1);
      expect(h.steps).toEqual([{ firedId: "t1", marking: m1 }]);
      expect(h.cursor).toBe(0);
    });

    it("appends sequentially, oldest->newest", () => {
      let h = SimHistory.init(m0);
      h = SimHistory.record(h, "t1", m1);
      h = SimHistory.record(h, "t2", m2);
      expect(h.steps.map((s) => s.firedId)).toEqual(["t1", "t2"]);
      expect(h.cursor).toBe(1);
    });

    it("discards the rewound future when firing from an earlier cursor", () => {
      let h = SimHistory.init(m0);
      h = SimHistory.record(h, "t1", m1);
      h = SimHistory.record(h, "t2", m2);
      h = SimHistory.goto(h, 0); // rewind to after t1
      h = SimHistory.record(h, "t3", m0); // branch off
      expect(h.steps.map((s) => s.firedId)).toEqual(["t1", "t3"]);
      expect(h.cursor).toBe(1);
    });

    it("from M0 (cursor -1) discards every step", () => {
      let h = SimHistory.init(m0);
      h = SimHistory.record(h, "t1", m1);
      h = SimHistory.goto(h, -1);
      h = SimHistory.record(h, "t2", m2);
      expect(h.steps.map((s) => s.firedId)).toEqual(["t2"]);
      expect(h.cursor).toBe(0);
    });
  });

  describe("markingAt", () => {
    const h = SimHistory.record(SimHistory.record(SimHistory.init(m0), "t1", m1), "t2", m2);

    it("returns M0 at cursor -1", () => {
      expect(SimHistory.markingAt(h, -1)).toBe(m0);
    });

    it("returns the step marking at a step cursor", () => {
      expect(SimHistory.markingAt(h, 0)).toBe(m1);
      expect(SimHistory.markingAt(h, 1)).toBe(m2);
    });

    it("clamps a too-large cursor to the last step", () => {
      expect(SimHistory.markingAt(h, 9)).toBe(m2);
    });

    it("returns M0 when there are no steps", () => {
      expect(SimHistory.markingAt(SimHistory.init(m0), 3)).toBe(m0);
    });
  });

  describe("goto", () => {
    const h = SimHistory.record(SimHistory.init(m0), "t1", m1);

    it("moves the cursor", () => {
      expect(SimHistory.goto(h, -1).cursor).toBe(-1);
    });

    it("clamps below -1", () => {
      expect(SimHistory.goto(h, -5).cursor).toBe(-1);
    });

    it("clamps above the last step", () => {
      expect(SimHistory.goto(h, 9).cursor).toBe(0);
    });

    it("leaves steps untouched", () => {
      expect(SimHistory.goto(h, -1).steps).toBe(h.steps);
    });
  });
});
