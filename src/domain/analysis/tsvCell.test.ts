import { describe, expect, it } from "vitest";
import { MatrixFormat } from "@/domain/analysis/matrixFormat";
import { TsvCell } from "@/domain/analysis/tsvCell";
import type { PetriNet } from "@/domain/types";

describe("TsvCell", () => {
  it("puts a quote in front of names that could run as formulas", () => {
    for (const name of ["=HYPERLINK(1)", "+cmd|x", "-1+2", "@SUM(A1)", "\t=1"]) {
      expect(TsvCell.clean(name).startsWith("'") || TsvCell.clean(name).startsWith(" ")).toBe(true);
    }
    expect(TsvCell.clean("=A1")).toBe("'=A1");
    expect(TsvCell.clean("Ready")).toBe("Ready");
  });

  it("leaves real numbers in the matrix as numbers", () => {
    const net: PetriNet = {
      places: [{ id: "p", name: "=P", tokens: 0, position: { x: 0, y: 0 } }],
      transitions: [{ id: "t", name: "T", position: { x: 0, y: 0 } }],
      arcs: [
        {
          id: "a",
          source: "p",
          target: "t",
          srcMagnetic: true,
          destMagnetic: true,
          multiplicity: 1,
          points: [],
        },
      ],
    };
    expect(MatrixFormat.toText(net)).toBe("\tT\n'=P\t-1");
  });
});
