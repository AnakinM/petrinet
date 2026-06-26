import { describe, expect, it } from "vitest";
import { NodeGeometry } from "@/domain/nodeGeometry";

const ORIGIN = { x: 0, y: 0 };

describe("NodeGeometry.circleBorderPoint", () => {
  it("clips along a cardinal direction at exactly the radius", () => {
    expect(NodeGeometry.circleBorderPoint(ORIGIN, 20, { x: 100, y: 0 })).toEqual({ x: 20, y: 0 });
    expect(NodeGeometry.circleBorderPoint(ORIGIN, 20, { x: 0, y: 100 })).toEqual({ x: 0, y: 20 });
  });

  it("clips along a diagonal at the radius", () => {
    const p = NodeGeometry.circleBorderPoint(ORIGIN, 20, { x: 10, y: 10 });
    expect(p.x).toBeCloseTo(Math.SQRT1_2 * 20, 6);
    expect(p.y).toBeCloseTo(Math.SQRT1_2 * 20, 6);
  });

  it("offsets from a non-zero center", () => {
    expect(NodeGeometry.circleBorderPoint({ x: 160, y: 0 }, 20, { x: 20, y: 0 })).toEqual({
      x: 140,
      y: 0,
    });
  });
});

describe("NodeGeometry.rectBorderPoint", () => {
  // Transition bar: 15 wide x 40 tall -> half-width 7.5, half-height 20.
  it("hits the short side for a horizontal approach", () => {
    expect(NodeGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 0, { x: 100, y: 0 })).toEqual({
      x: 7.5,
      y: 0,
    });
  });

  it("hits the long side for a vertical approach", () => {
    expect(NodeGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 0, { x: 0, y: -100 })).toEqual({
      x: 0,
      y: -20,
    });
  });

  it("rotates the box: a horizontal approach to a 90deg bar hits the long axis", () => {
    const p = NodeGeometry.rectBorderPoint(ORIGIN, 7.5, 20, 90, { x: 100, y: 0 });
    expect(p.x).toBeCloseTo(20, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it("returns the center when the target coincides with it", () => {
    expect(NodeGeometry.rectBorderPoint({ x: 5, y: 5 }, 7.5, 20, 0, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
    });
  });
});

describe("NodeGeometry shape dispatchers", () => {
  it("places clip at radius 20 from center", () => {
    expect(NodeGeometry.placeBorderPoint({ x: 0, y: 0 }, { x: 50, y: 0 })).toEqual({ x: 20, y: 0 });
  });

  it("transitions clip on the rotated bar (90deg bar, horizontal approach hits the long axis)", () => {
    const p = NodeGeometry.transitionBorderPoint({ x: 0, y: 0 }, 90, { x: 100, y: 0 });
    expect(p.x).toBeCloseTo(20, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });
});
