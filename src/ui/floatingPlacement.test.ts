import { describe, expect, it } from "vitest";
import { FloatingPlacement } from "@/ui/floatingPlacement";

const VIEWPORT = { width: 1000, height: 800 };
const LABEL = { width: 100, height: 30 };
const { GAP, MARGIN } = FloatingPlacement;

describe("FloatingPlacement.place", () => {
  it("centres the box below the anchor", () => {
    const anchor = { left: 400, top: 10, width: 40, height: 30 };
    expect(FloatingPlacement.place(anchor, LABEL, VIEWPORT)).toEqual({
      left: 370,
      top: 40 + GAP,
      side: "below",
    });
  });

  it("flips above when the box does not fit below", () => {
    const anchor = { left: 400, top: 760, width: 40, height: 30 };
    expect(FloatingPlacement.place(anchor, LABEL, VIEWPORT)).toEqual({
      left: 370,
      top: 760 - GAP - 30,
      side: "above",
    });
  });

  it("stays below and shifts up when it fits on neither side", () => {
    const anchor = { left: 400, top: 20, width: 40, height: 760 };
    const tall = { width: 100, height: 200 };
    const placed = FloatingPlacement.place(anchor, tall, VIEWPORT);
    expect(placed.side).toBe("below");
    expect(placed.top).toBe(800 - MARGIN - 200);
  });

  it("keeps a margin from the left and the right edge", () => {
    const nearLeft = { left: 0, top: 10, width: 20, height: 20 };
    const nearRight = { left: 990, top: 10, width: 10, height: 20 };
    expect(FloatingPlacement.place(nearLeft, LABEL, VIEWPORT).left).toBe(MARGIN);
    expect(FloatingPlacement.place(nearRight, LABEL, VIEWPORT).left).toBe(1000 - MARGIN - 100);
  });

  it("puts the left edge at the anchor with start alignment, for a pointer point", () => {
    const pointer = { left: 300, top: 200, width: 0, height: 0 };
    expect(FloatingPlacement.place(pointer, LABEL, VIEWPORT, "start")).toEqual({
      left: 300,
      top: 200 + GAP,
      side: "below",
    });
  });
});
