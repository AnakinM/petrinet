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

describe("ArcGeometry.bendAt", () => {
  const arc = [
    { x: 0, y: 0 }, // source endpoint
    { x: 50, y: 0 }, // bend 1
    { x: 50, y: 50 }, // bend 2
    { x: 100, y: 50 }, // target endpoint
  ];

  it("returns the index of the bend under the cursor", () => {
    expect(ArcGeometry.bendAt(arc, { x: 52, y: 3 }, 8)).toBe(1);
    expect(ArcGeometry.bendAt(arc, { x: 48, y: 47 }, 8)).toBe(2);
  });

  it("returns null when the cursor is outside tolerance of every bend", () => {
    expect(ArcGeometry.bendAt(arc, { x: 25, y: 25 }, 8)).toBeNull();
  });

  it("never matches an endpoint", () => {
    expect(ArcGeometry.bendAt(arc, { x: 0, y: 0 }, 8)).toBeNull();
    expect(ArcGeometry.bendAt(arc, { x: 100, y: 50 }, 8)).toBeNull();
  });

  it("returns null for a straight arc with no interior bends", () => {
    expect(
      ArcGeometry.bendAt(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        { x: 5, y: 0 },
        8,
      ),
    ).toBeNull();
  });

  it("picks the nearest bend when several are in range", () => {
    const close = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 16, y: 0 },
      { x: 30, y: 0 },
    ];
    // Cursor at x=13 is within 8 of both bends (10 and 16) but closer to 16.
    expect(ArcGeometry.bendAt(close, { x: 13.5, y: 0 }, 8)).toBe(2);
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
