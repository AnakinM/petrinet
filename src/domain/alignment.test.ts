import { describe, expect, it } from "vitest";
import { AlignmentGuides } from "@/domain/alignment";

describe("AlignmentGuides.resolve (non-snap)", () => {
  it("pulls the center to a sibling's axis within tolerance and emits a spanning guide", () => {
    const { position, guides } = AlignmentGuides.resolve(
      { x: 103, y: 200 },
      [{ x: 100, y: 50 }],
      false,
    );
    expect(position).toEqual({ x: 100, y: 200 });
    // One vertical guide at x=100 spanning the ghost (200) and the sibling (50), padded by EXTENT.
    expect(guides).toEqual([{ orientation: "vertical", at: 100, from: 26, to: 224 }]);
  });

  it("does not pull beyond the tolerance", () => {
    const { position, guides } = AlignmentGuides.resolve(
      { x: 110, y: 200 },
      [{ x: 100, y: 50 }],
      false,
    );
    expect(position).toEqual({ x: 110, y: 200 });
    expect(guides).toEqual([]);
  });

  it("aligns each axis independently (one vertical + one horizontal)", () => {
    const { position, guides } = AlignmentGuides.resolve(
      { x: 102, y: 48 },
      [{ x: 100, y: 50 }],
      false,
    );
    expect(position).toEqual({ x: 100, y: 50 });
    expect(guides).toHaveLength(2);
    expect(guides).toContainEqual({ orientation: "vertical", at: 100, from: 26, to: 74 });
    expect(guides).toContainEqual({ orientation: "horizontal", at: 50, from: 76, to: 124 });
  });

  it("aligns to the nearest of several candidate siblings", () => {
    const { position } = AlignmentGuides.resolve(
      { x: 104, y: 500 },
      [
        { x: 100, y: 0 },
        { x: 107, y: 10 },
      ],
      false,
    );
    expect(position.x).toBe(107); // |107-104|=3 beats |100-104|=4
  });

  it("collapses many siblings sharing an axis into a single guide spanning them all", () => {
    const { guides } = AlignmentGuides.resolve(
      { x: 100, y: 100 },
      [
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 100 },
      ],
      false,
    );
    expect(guides).toHaveLength(2);
    expect(guides).toContainEqual({ orientation: "vertical", at: 100, from: -24, to: 124 });
    expect(guides).toContainEqual({ orientation: "horizontal", at: 100, from: -24, to: 124 });
  });
});

describe("AlignmentGuides.resolve (snap)", () => {
  it("grid-snaps the position and draws a guide only on an exact axis match", () => {
    const { position, guides } = AlignmentGuides.resolve({ x: 13, y: 13 }, [{ x: 24, y: 0 }], true);
    expect(position).toEqual({ x: 24, y: 24 });
    expect(guides).toEqual([{ orientation: "vertical", at: 24, from: -24, to: 48 }]);
  });

  it("does not pull to (or guide toward) a near-but-unaligned sibling", () => {
    const { position, guides } = AlignmentGuides.resolve(
      { x: 13, y: 13 },
      [{ x: 27, y: 200 }],
      true,
    );
    expect(position).toEqual({ x: 24, y: 24 });
    expect(guides).toEqual([]);
  });
});
