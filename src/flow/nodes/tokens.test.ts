import { describe, expect, it } from "vitest";
import { PlaceTokens } from "@/flow/nodes/tokens";

describe("PlaceTokens.display", () => {
  it("renders nothing for an empty place", () => {
    expect(PlaceTokens.display(0)).toEqual({ kind: "empty" });
  });

  it("treats negative counts as empty", () => {
    expect(PlaceTokens.display(-3)).toEqual({ kind: "empty" });
  });

  it("renders dots up to the threshold", () => {
    expect(PlaceTokens.display(1)).toEqual({ kind: "dots", count: 1 });
    expect(PlaceTokens.display(PlaceTokens.MAX_DOTS)).toEqual({
      kind: "dots",
      count: PlaceTokens.MAX_DOTS,
    });
  });

  it("switches to a numeral above the threshold", () => {
    expect(PlaceTokens.display(PlaceTokens.MAX_DOTS + 1)).toEqual({
      kind: "number",
      value: PlaceTokens.MAX_DOTS + 1,
    });
    expect(PlaceTokens.display(42)).toEqual({ kind: "number", value: 42 });
  });
});
