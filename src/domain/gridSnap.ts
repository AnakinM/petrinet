import type { Vec2 } from "@/domain/types";

/**
 * Snap helper for the build canvas. A node *center* snaps to a square grid whose spacing matches
 * the 24px Background lines, so a placed or dragged node lands on a visible intersection. Pure and
 * framework-free, so the canvas placement/drag paths and the unit tests share one definition of
 * the grid. Arc bends are deliberately never snapped — they stay freeform.
 */
export class GridSnap {
  /** Grid spacing in flow units; matches the canvas Background `gap`. */
  static readonly SIZE = 24;

  /** Round a point (a node center) to the nearest grid intersection. */
  static snap(point: Vec2): Vec2 {
    return {
      x: Math.round(point.x / GridSnap.SIZE) * GridSnap.SIZE,
      y: Math.round(point.y / GridSnap.SIZE) * GridSnap.SIZE,
    };
  }
}
