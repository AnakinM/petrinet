import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import { TsvCell } from "@/domain/analysis/tsvCell";
import type { PetriNet } from "@/domain/types";

// Keep in sync with LATEX_ESCAPES in src/codec/tikz.ts (branch formats-tikz); to be merged into one module.
const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "<": "\\textless{}",
  ">": "\\textgreater{}",
  "|": "\\textbar{}",
  "-": "{-}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
};

/**
 * The incidence matrix as text for pasting: places as rows, transitions as columns, element names
 * (not ids) in the headers. Pure and framework-free. Negative numbers use the plain hyphen.
 */
export class MatrixFormat {
  /** Tab-separated, one line per row, a header row of transition names first. Pastes as a table. */
  static toText(net: PetriNet): string {
    const m = new IncidenceMatrix(net);
    const clean = TsvCell.clean;
    const header = ["", ...net.transitions.map((t) => clean(t.name))];
    const rows = net.places.map((p, i) => [clean(p.name), ...m.c[i].map(String)]);
    return [header, ...rows].map((cells) => cells.join("\t")).join("\n");
  }

  /** A LaTeX `tabular`: names escaped, a header row, a rule under it, numbers right aligned. */
  static toLatex(net: PetriNet): string {
    const m = new IncidenceMatrix(net);
    const columns = `l${"r".repeat(net.transitions.length)}`;
    const header = ["", ...net.transitions.map((t) => MatrixFormat.escapeLatex(t.name))];
    const rows = net.places.map((p, i) => [
      MatrixFormat.escapeLatex(p.name),
      ...m.c[i].map(String),
    ]);
    const line = (cells: string[]): string => `${cells.join(" & ")} \\\\`;
    return [
      `\\begin{tabular}{${columns}}`,
      line(header),
      "\\hline",
      ...rows.map(line),
      "\\end{tabular}",
    ].join("\n");
  }

  /** Escapes the characters LaTeX treats as special so a name prints as typed. */
  static escapeLatex(text: string): string {
    return text.replace(/\s+/g, " ").replace(/[\\{}$&#^_%~<>|-]/g, (c) => LATEX_ESCAPES[c]);
  }
}
