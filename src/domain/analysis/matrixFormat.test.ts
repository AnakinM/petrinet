import { describe, expect, it } from "vitest";
import { MatrixFormat } from "@/domain/analysis/matrixFormat";
import type { PetriNet } from "@/domain/types";

const net: PetriNet = {
  places: [
    { id: "p1", name: "Ready_1", tokens: 0, position: { x: 0, y: 0 } },
    { id: "p2", name: "Cost $", tokens: 0, position: { x: 0, y: 0 } },
  ],
  transitions: [{ id: "t1", name: "Go & 50%", position: { x: 0, y: 0 } }],
  arcs: [
    {
      id: "a1",
      source: "p1",
      target: "t1",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 2,
      points: [],
    },
    {
      id: "a2",
      source: "t1",
      target: "p2",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [],
    },
  ],
};

describe("MatrixFormat", () => {
  it("writes tab-separated text with a header row and names", () => {
    expect(MatrixFormat.toText(net)).toBe("\tGo & 50%\nReady_1\t-2\nCost $\t1");
  });

  it("writes a LaTeX tabular with escaped names and plain hyphens", () => {
    expect(MatrixFormat.toLatex(net)).toBe(
      [
        "\\begin{tabular}{lr}",
        " & Go \\& 50\\% \\\\",
        "\\hline",
        "Ready\\_1 & -2 \\\\",
        "Cost \\$ & 1 \\\\",
        "\\end{tabular}",
      ].join("\n"),
    );
  });

  it("escapes every LaTeX special character", () => {
    expect(MatrixFormat.escapeLatex("\\&%$#_{}~^<>|-")).toBe(
      "\\textbackslash{}\\&\\%\\$\\#\\_\\{\\}\\textasciitilde{}\\textasciicircum{}\\textless{}\\textgreater{}\\textbar{}{-}",
    );
  });

  it("handles a net with no transitions", () => {
    const empty: PetriNet = { ...net, transitions: [], arcs: [] };
    expect(MatrixFormat.toLatex(empty)).toContain("{tabular}{l}");
  });
});
