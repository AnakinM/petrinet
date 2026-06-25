import { describe, expect, it } from "vitest";
import { ArcGeometry } from "@/flow/edges/arcGeometry";

const ORIGIN = { x: 0, y: 0 };

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

describe("ArcGeometry.circleBorderPoint", () => {
  it("clips along a cardinal direction at exactly the radius", () => {
    expect(ArcGeometry.circleBorderPoint(ORIGIN, 20, { x: 100, y: 0 })).toEqual({ x: 20, y: 0 });
    expect(ArcGeometry.circleBorderPoint(ORIGIN, 20, { x: 0, y: 100 })).toEqual({ x: 0, y: 20 });
  });

  it("clips along a diagonal at the radius", () => {
    const p = ArcGeometry.circleBorderPoint(ORIGIN, 20, { x: 10, y: 10 });
    expect(p.x).toBeCloseTo(Math.SQRT1_2 * 20, 6);
    expect(p.y).toBeCloseTo(Math.SQRT1_2 * 20, 6);
  });

  it("offsets from a non-zero center", () => {
    expect(ArcGeometry.circleBorderPoint({ x: 160, y: 0 }, 20, { x: 20, y: 0 })).toEqual({
      x: 140,
      y: 0,
    });
  });
});

describe("ArcGeometry.rectBorderPoint", () => {
  // Transition bar: 15 wide x 40 tall -> half-width 7.5, half-height 20.
  it("hits the short side for a horizontal approach", () => {
    expect(ArcGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 0, { x: 100, y: 0 })).toEqual({
      x: 7.5,
      y: 0,
    });
  });

  it("hits the long side for a vertical approach", () => {
    expect(ArcGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 0, { x: 0, y: -100 })).toEqual({
      x: 0,
      y: -20,
    });
  });

  it("rotates the box: a horizontal approach to a 90deg bar hits the long axis", () => {
    const p = ArcGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 90, { x: 100, y: 0 });
    expect(p.x).toBeCloseTo(20, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("returns the center when the target coincides with it", () => {
    expect(ArcGeometry.rectBorderPoint({ x: 5, y: 5 }, 7.5, 20, 0, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
    });
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
