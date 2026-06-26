import { describe, expect, it } from "vitest";
import { ArcGeometry } from "@/flow/edges/arcGeometry";

describe("ArcGeometry.path", () => {
  it("builds a moveto + lineto polyline", () => {
    expect(
      ArcGeometry.path([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe("M 0 0 L 10 0 L 10 10");
  });

  it("emits a lone moveto for a degenerate single point", () => {
    expect(ArcGeometry.path([{ x: 3, y: 4 }])).toBe("M 3 4");
  });
});

describe("ArcGeometry.midpoint", () => {
  it("returns the average for a straight two-point arc", () => {
    expect(
      ArcGeometry.midpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toEqual({ x: 5, y: 0 });
  });

  it("lands at the halfway point by arc length, not by vertex count", () => {
    // Two equal 10-unit legs: the midpoint is exactly the corner vertex.
    expect(
      ArcGeometry.midpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });
});
