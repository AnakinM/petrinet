import type { Vec2 } from "@/domain/types";

/**
 * Canonical node dimensions and border-intersection math, shared by the view (node
 * components render at these sizes) and the editing layer (a new arc or a dragged
 * endpoint clips to the border here).
 *
 * The dimensions are fixed by the `.npn` geometry — place ⌀40 (radius 20), transition
 * bar 15×40 — so stored magnetic arc endpoints land exactly on the rendered borders.
 * Pure and framework-free; the low-level helpers are unit-tested in isolation.
 */
export class NodeGeometry {
  /** Place circle: diameter and radius. */
  static readonly PLACE_DIAMETER = 40;
  static readonly PLACE_RADIUS = 20;
  /** Transition bar, drawn inside a square box so any rotation stays bounded. */
  static readonly TRANSITION_BAR_WIDTH = 15;
  static readonly TRANSITION_BAR_HEIGHT = 40;
  static readonly TRANSITION_BOX = 40;

  /** Border point of a place (circle) along the direction from its center to `toward`. */
  static placeBorderPoint(center: Vec2, toward: Vec2): Vec2 {
    return NodeGeometry.circleBorderPoint(center, NodeGeometry.PLACE_RADIUS, toward);
  }

  /** Border point of a transition bar (rotated rect) along center→`toward`. */
  static transitionBorderPoint(center: Vec2, rotationDeg: number, toward: Vec2): Vec2 {
    return NodeGeometry.rectBorderPoint(
      center,
      NodeGeometry.TRANSITION_BAR_WIDTH / 2,
      NodeGeometry.TRANSITION_BAR_HEIGHT / 2,
      rotationDeg,
      toward,
    );
  }

  /** True iff `point` lies within the place circle (plus `pad`). */
  static placeContains(center: Vec2, point: Vec2, pad = 0): boolean {
    return Math.hypot(point.x - center.x, point.y - center.y) <= NodeGeometry.PLACE_RADIUS + pad;
  }

  /** True iff `point` lies within the transition bar (rotated rect, plus `pad`). */
  static transitionContains(center: Vec2, rotationDeg: number, point: Vec2, pad = 0): boolean {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const theta = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // Rotate the offset into the bar's local (axis-aligned) frame, matching rectBorderPoint.
    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;
    return (
      Math.abs(localX) <= NodeGeometry.TRANSITION_BAR_WIDTH / 2 + pad &&
      Math.abs(localY) <= NodeGeometry.TRANSITION_BAR_HEIGHT / 2 + pad
    );
  }

  /** Point on a circle of `radius` around `center`, in the direction of `toward`. */
  static circleBorderPoint(center: Vec2, radius: number, toward: Vec2): Vec2 {
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius };
  }

  /**
   * Point where the ray center→`toward` exits an axis box of half-size (`halfWidth`,
   * `halfHeight`) rotated `rotationDeg` clockwise about `center`. Used for transition bars.
   */
  static rectBorderPoint(
    center: Vec2,
    halfWidth: number,
    halfHeight: number,
    rotationDeg: number,
    toward: Vec2,
  ): Vec2 {
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (dx === 0 && dy === 0) return { x: center.x, y: center.y };
    const theta = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // Rotate the direction into the box's local (axis-aligned) frame.
    const localX = cos * dx + sin * dy;
    const localY = -sin * dx + cos * dy;
    // Scale the local ray until it just touches the nearer pair of edges.
    const scale = 1 / Math.max(Math.abs(localX) / halfWidth, Math.abs(localY) / halfHeight);
    const hitX = localX * scale;
    const hitY = localY * scale;
    // Rotate the local hit back into world space.
    return { x: center.x + (cos * hitX - sin * hitY), y: center.y + (sin * hitX + cos * hitY) };
  }
}
