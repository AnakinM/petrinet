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

describe("ArcGeometry.roundedPath", () => {
  it("falls back to a straight polyline when there are no interior corners", () => {
    const straight = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(ArcGeometry.roundedPath(straight)).toBe("M 0 0 L 10 0");
  });

  it("keeps both endpoints sharp and rounds the interior vertex with a quadratic", () => {
    // L-shape with 40-unit legs: each leg is long enough to take the full 8px cut.
    const path = ArcGeometry.roundedPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
      8,
    );
    // Starts at the sharp source endpoint, ends at the sharp target endpoint.
    expect(path.startsWith("M 0 0 ")).toBe(true);
    expect(path.endsWith(" L 40 40")).toBe(true);
    // Cut back 8 along each leg, joined through the corner (40,0) as the control point.
    expect(path).toBe("M 0 0 L 32 0 Q 40 0 40 8 L 40 40");
  });

  it("clamps the cut to half the shorter adjacent segment", () => {
    // The second leg is only 10 long, so the radius is clamped to 5 (not 8).
    const path = ArcGeometry.roundedPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 10 },
      ],
      8,
    );
    expect(path).toBe("M 0 0 L 35 0 Q 40 0 40 5 L 40 10");
  });

  it("rounds every interior vertex of a multi-bend polyline", () => {
    const path = ArcGeometry.roundedPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 80, y: 40 },
      ],
      8,
    );
    expect(path).toBe("M 0 0 L 32 0 Q 40 0 40 8 L 40 32 Q 40 40 48 40 L 80 40");
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
