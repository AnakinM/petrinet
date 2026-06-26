import { describe, expect, it } from "vitest";
import { GridSnap } from "@/domain/gridSnap";

describe("GridSnap", () => {
  it("snaps a point to the nearest 24px intersection", () => {
    expect(GridSnap.snap({ x: 10, y: 10 })).toEqual({ x: 0, y: 0 });
    expect(GridSnap.snap({ x: 13, y: 35 })).toEqual({ x: 24, y: 24 });
    expect(GridSnap.snap({ x: 40, y: 60 })).toEqual({ x: 48, y: 72 });
  });

  it("leaves a point already on the grid unchanged", () => {
    expect(GridSnap.snap({ x: 48, y: 72 })).toEqual({ x: 48, y: 72 });
  });

  it("rounds the half-way point up, per Math.round", () => {
    expect(GridSnap.snap({ x: 12, y: 36 })).toEqual({ x: 24, y: 48 });
  });

  it("snaps negative coordinates", () => {
    expect(GridSnap.snap({ x: -30, y: -30 })).toEqual({ x: -24, y: -24 });
  });
});
