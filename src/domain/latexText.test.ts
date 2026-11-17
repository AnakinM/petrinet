import { describe, expect, it } from "vitest";

import { LatexText } from "@/domain/latexText";

describe("LatexText.escape", () => {
  it("leaves plain text alone", () => {
    expect(LatexText.escape("Producer 1")).toBe("Producer 1");
  });

  it("escapes every special character", () => {
    expect(LatexText.escape("\\{}$&#^_%~<>|-")).toBe(
      "\\textbackslash{}\\{\\}\\$\\&\\#\\textasciicircum{}\\_\\%\\textasciitilde{}\\textless{}\\textgreater{}\\textbar{}{-}",
    );
  });

  it("does not touch whitespace", () => {
    expect(LatexText.escape("a  b\nc")).toBe("a  b\nc");
  });
});
