const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/**
 * Browser-side text copy for the Analysis panel's copy buttons. A table goes on the clipboard twice:
 * as tab-separated `text/plain`, which a spreadsheet splits into cells, and as a simple `text/html`
 * table, because Word pastes tab-separated text as plain text and only an HTML table as a table.
 */
export class TextClipboard {
  /**
   * Put `text` on the clipboard, and `html` beside it when given and the browser can hold both.
   * Call it directly in the click handler: browsers allow the write only during a visitor's action.
   * Rejects when the page has no clipboard access (an insecure page or an old browser), and also
   * when the browser throws at once instead of rejecting, so every failure reaches the caller.
   */
  static write(text: string, html?: string): Promise<void> {
    try {
      const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
      if (html !== undefined && typeof ClipboardItem === "function" && clipboard?.write) {
        const item = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        });
        return clipboard.write([item]);
      }
      if (clipboard?.writeText) return clipboard.writeText(text);
      return Promise.reject(new Error("The clipboard is not available."));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** Write a tab-separated table as both `text/plain` and an HTML table (see {@link htmlTable}). */
  static writeTable(tsv: string): Promise<void> {
    return TextClipboard.write(tsv, TextClipboard.htmlTable(tsv));
  }

  /**
   * A simple HTML table from tab-separated text: the first line becomes the header row, every cell
   * is escaped, and thin borders keep the grid visible after a paste into a document.
   */
  static htmlTable(tsv: string): string {
    const [head, ...body] = tsv.split("\n").map((line) => line.split("\t"));
    const cell = (tag: "th" | "td", text: string): string =>
      `<${tag} style="border:1px solid #94a3b8;padding:2px 6px">${TextClipboard._escape(text)}</${tag}>`;
    const row = (tag: "th" | "td", cells: string[]): string =>
      `<tr>${cells.map((c) => cell(tag, c)).join("")}</tr>`;
    return [
      '<table style="border-collapse:collapse">',
      `<thead>${row("th", head ?? [])}</thead>`,
      `<tbody>${body.map((cells) => row("td", cells)).join("")}</tbody>`,
      "</table>",
    ].join("");
  }

  private static _escape(text: string): string {
    return text.replace(/[&<>"]/g, (c) => HTML_ESCAPES[c]);
  }
}
