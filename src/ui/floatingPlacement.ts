/** A box in viewport pixels, as `getBoundingClientRect()` reports it. A point is a 0 by 0 box. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A width and a height in pixels. */
export interface Size {
  width: number;
  height: number;
}

/**
 * How the floating box lines up with its anchor horizontally: `center` centres it under the anchor,
 * `start` puts its left edge at the anchor's left edge (for example at the pointer).
 */
export type FloatingAlign = "center" | "start";

/** Where the floating box goes: its top-left corner in viewport pixels, and the side it took. */
export interface Placement {
  left: number;
  top: number;
  side: "below" | "above";
}

/**
 * Pure placement of a floating box (a tooltip, a help card) next to an anchor, in viewport pixels,
 * for a `position: fixed` element. The box goes below the anchor and flips above when it fits only
 * there. It then shifts as needed to keep a margin from every viewport edge.
 */
export class FloatingPlacement {
  /** Space between the anchor and the floating box. */
  static readonly GAP = 6;
  /** Smallest distance between the floating box and a viewport edge. */
  static readonly MARGIN = 8;

  static place(
    anchor: Box,
    floating: Size,
    viewport: Size,
    align: FloatingAlign = "center",
  ): Placement {
    const { GAP, MARGIN } = FloatingPlacement;
    const below = anchor.top + anchor.height + GAP;
    const above = anchor.top - GAP - floating.height;
    const fitsBelow = below + floating.height <= viewport.height - MARGIN;
    const fitsAbove = above >= MARGIN;
    const side = fitsBelow || !fitsAbove ? "below" : "above";

    const left =
      align === "center" ? anchor.left + (anchor.width - floating.width) / 2 : anchor.left;
    return {
      left: FloatingPlacement._clamp(left, floating.width, viewport.width),
      top: FloatingPlacement._clamp(
        side === "below" ? below : above,
        floating.height,
        viewport.height,
      ),
      side,
    };
  }

  /** Keep `start` so the span of `length` stays `MARGIN` inside `0..limit`, the start edge winning. */
  private static _clamp(start: number, length: number, limit: number): number {
    const max = limit - FloatingPlacement.MARGIN - length;
    return Math.max(FloatingPlacement.MARGIN, Math.min(start, max));
  }
}
