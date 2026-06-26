import type { Vec2 } from "@/domain/types";

/**
 * Pure arc geometry: polyline path building and weight-label placement.
 *
 * The `.npn` polyline is rendered verbatim — its endpoints are stored already clipped to
 * the node border — so {@link ArcGeometry.path} just strings the points together. Border
 * intersection (where a new or dragged endpoint meets the node shape) lives on
 * {@link NodeGeometry}, with the node dimensions it depends on. Kept framework-free so it
 * is unit-testable in isolation.
 */
export class ArcGeometry {
  /** SVG path command string for a straight-segment polyline through `points`. */
  static path(points: Vec2[]): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }

  /**
   * Point halfway along the polyline by arc length — where the weight label sits.
   * The stored arc `labelPosition` is preserved for round-tripping but not rendered
   * here (its convention is not derivable from the reference file); the label is drawn
   * at this computed midpoint instead.
   */
  static midpoint(points: Vec2[]): Vec2 {
    const last = points.length - 1;
    let total = 0;
    for (let i = 0; i < last; i++) total += ArcGeometry._segLength(points[i], points[i + 1]);
    let remaining = total / 2;
    for (let i = 0; i < last; i++) {
      const seg = ArcGeometry._segLength(points[i], points[i + 1]);
      if (remaining <= seg || i === last - 1) {
        const t = seg === 0 ? 0 : remaining / seg;
        return {
          x: points[i].x + (points[i + 1].x - points[i].x) * t,
          y: points[i].y + (points[i + 1].y - points[i].y) * t,
        };
      }
      remaining -= seg;
    }
    return { x: points[0].x, y: points[0].y };
  }

  private static _segLength(a: Vec2, b: Vec2): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}
