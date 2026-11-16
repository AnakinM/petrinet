import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import type { PetriNet } from "@/domain/types";

/**
 * The incidence matrix as text for pasting: places as rows, transitions as columns, element names
 * (not ids) in the headers. Pure and framework-free. Negative numbers use the plain hyphen.
 */
export class MatrixFormat {
  /** Tab-separated, one line per row, a header row of transition names first. Pastes as a table. */
  static toText(net: PetriNet): string {
    const m = new IncidenceMatrix(net);
    const clean = (name: string): string => name.replace(/[\t\r\n]+/g, " ");
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
    const map: Record<string, string> = {
      "\\": "\\textbackslash{}",
      "&": "\\&",
      "%": "\\%",
      $: "\\$",
      "#": "\\#",
      _: "\\_",
      "{": "\\{",
      "}": "\\}",
      "~": "\\textasciitilde{}",
      "^": "\\textasciicircum{}",
    };
    return text.replace(/[\\&%$#_{}~^]/g, (c) => map[c]).replace(/\s+/g, " ");
  }
}
