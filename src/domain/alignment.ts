import { GridSnap } from "@/domain/gridSnap";
import type { Vec2 } from "@/domain/types";

/**
 * A single alignment guide line. A `vertical` guide sits at constant x = `at` and runs from y =
 * `from` to y = `to`; a `horizontal` guide sits at constant y = `at` and runs x = `from`..`to`.
 */
export interface Guide {
  orientation: "vertical" | "horizontal";
  at: number;
  from: number;
  to: number;
}

/** A resolved placement: where the node center lands, and the guides to draw for it. */
export interface Alignment {
  position: Vec2;
  guides: Guide[];
}

/**
 * Center-axis alignment for a placing ghost or a dragged node, against the other nodes' centers.
 *
 * - **snap on:** the position is the 24px grid snap ({@link GridSnap}); a guide appears only where
 *   that grid point lands exactly on another node's axis (visual-only, no extra pull).
 * - **snap off:** the position is pulled to the nearest sibling axis within {@link TOLERANCE} on
 *   each axis independently.
 *
 * A guide is emitted per axis the final center shares with at least one other node — at most one
 * vertical and one horizontal — each spanning the aligned centers plus {@link EXTENT} beyond the
 * outermost. Pure and framework-free; the canvas layers render the returned guides.
 */
export class AlignmentGuides {
  /** Pull-to-align tolerance (flow px) to another node's center axis, in non-snap mode. */
  static readonly TOLERANCE = 5;
  /** How far a guide line extends beyond the outermost aligned centers. */
  static readonly EXTENT = 24;

  static resolve(proposed: Vec2, others: Vec2[], snap: boolean): Alignment {
    const base = snap ? GridSnap.snap(proposed) : proposed;
    const x = snap ? base.x : AlignmentGuides._pull(base.x, others, (o) => o.x);
    const y = snap ? base.y : AlignmentGuides._pull(base.y, others, (o) => o.y);
    const position = { x, y };

    const guides: Guide[] = [];
    const column = others.filter((o) => o.x === x); // share the vertical axis
    if (column.length > 0) {
      const ys = [y, ...column.map((o) => o.y)];
      guides.push({
        orientation: "vertical",
        at: x,
        from: Math.min(...ys) - AlignmentGuides.EXTENT,
        to: Math.max(...ys) + AlignmentGuides.EXTENT,
      });
    }
    const row = others.filter((o) => o.y === y); // share the horizontal axis
    if (row.length > 0) {
      const xs = [x, ...row.map((o) => o.x)];
      guides.push({
        orientation: "horizontal",
        at: y,
        from: Math.min(...xs) - AlignmentGuides.EXTENT,
        to: Math.max(...xs) + AlignmentGuides.EXTENT,
      });
    }
    return { position, guides };
  }

  /** Nearest sibling axis within TOLERANCE of `v` (returning its exact value), else `v`. */
  private static _pull(v: number, others: Vec2[], axis: (o: Vec2) => number): number {
    let best = v;
    let bestDist = AlignmentGuides.TOLERANCE;
    for (const o of others) {
      const a = axis(o);
      const dist = Math.abs(a - v);
      if (dist <= bestDist) {
        best = a;
        bestDist = dist;
      }
    }
    return best;
  }
}
