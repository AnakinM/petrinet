import type { Vec2 } from "@/domain/types";

/**
 * Pure arc geometry: polyline path building, node-border intersection, label placement.
 *
 * The `.npn` polyline is rendered verbatim — its endpoints are stored already clipped to
 * the node border — so {@link ArcGeometry.path} just strings the points together. The
 * border-intersection helpers compute where the line from a node center meets the node
 * shape; they are used when creating a new arc and when a node moves (a magnetic endpoint
 * re-clips to the border). Kept framework-free so it is unit-testable in isolation.
 */
export class ArcGeometry {
  /** SVG path command string for a straight-segment polyline through `points`. */
  static path(points: Vec2[]): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
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
