/** Escaping for text that goes into a LaTeX document (TikZ node labels, table cells). */
export class LatexText {
  private static readonly _ESCAPES: Record<string, string> = {
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

  /** Escapes the characters LaTeX treats as special so the text prints as typed. Whitespace is untouched. */
  static escape(text: string): string {
    return text.replace(/[\\{}$&#^_%~<>|-]/g, (c) => LatexText._ESCAPES[c]);
  }
}
