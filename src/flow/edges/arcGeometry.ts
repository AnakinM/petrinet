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
  /** Default corner radius (flow-space) for {@link ArcGeometry.roundedPath}. */
  static readonly CORNER_RADIUS = 8;

  /** SVG path command string for a straight-segment polyline through `points`. */
  static path(points: Vec2[]): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }

  /**
   * SVG path that rounds every *interior* vertex with a smooth quadratic, leaving the two
   * endpoints sharp (clean arrowhead tip and source attachment). Render-only: the stored
   * `points` and the {@link ArcGeometry.midpoint} weight-label anchor are untouched, so this
   * never affects `.npn` geometry.
   *
   * Each corner is cut back along both adjacent segments by `radius`, clamped to half the
   * shorter of the two so adjacent corners never overlap, then joined through the original
   * vertex as the quadratic control point.
   */
  static roundedPath(points: Vec2[], radius: number = ArcGeometry.CORNER_RADIUS): string {
    const last = points.length - 1;
    if (last < 2) return ArcGeometry.path(points);
    const parts = [`M ${points[0].x} ${points[0].y}`];
    for (let i = 1; i < last; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const r = Math.min(
        radius,
        ArcGeometry._segLength(prev, curr) / 2,
        ArcGeometry._segLength(curr, next) / 2,
      );
      const entry = ArcGeometry._backOff(curr, prev, r);
      const exit = ArcGeometry._backOff(curr, next, r);
      parts.push(`L ${entry.x} ${entry.y}`);
      parts.push(`Q ${curr.x} ${curr.y} ${exit.x} ${exit.y}`);
    }
    parts.push(`L ${points[last].x} ${points[last].y}`);
    return parts.join(" ");
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

  /**
   * Index into `points` of the interior vertex (a removable bend) within `tolerance` of
   * `cursor`, or `null` when none qualify. The two endpoints are excluded — only bends are
   * removable. The nearest bend wins when several are in range. All arguments share one
   * coordinate space; the caller passes flow-space points with a zoom-scaled tolerance so the
   * target stays a constant size on screen. Drives rule 3 of the unified right-click policy.
   */
  static bendAt(points: Vec2[], cursor: Vec2, tolerance: number): number | null {
    let best: number | null = null;
    let bestDist = tolerance;
    for (let i = 1; i < points.length - 1; i++) {
      const dist = ArcGeometry._segLength(points[i], cursor);
      if (dist <= bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  private static _segLength(a: Vec2, b: Vec2): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** Point `dist` away from `from` along the direction `from`→`toward`. */
  private static _backOff(from: Vec2, toward: Vec2, dist: number): Vec2 {
    const len = ArcGeometry._segLength(from, toward) || 1;
    return {
      x: from.x + ((toward.x - from.x) / len) * dist,
      y: from.y + ((toward.y - from.y) / len) * dist,
    };
  }
}
