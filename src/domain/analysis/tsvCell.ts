/** Cleans a name for a tab-separated cell so a spreadsheet keeps every cell where it belongs. */
export class TsvCell {
  /**
   * For text cells (names), never numbers. Tabs and line breaks become spaces; double quotes become
   * single quotes (a leading quote merges cells); a leading `=`, `+`, `-` or `@` gets a single quote
   * in front so a pasted name cannot run as a spreadsheet formula.
   */
  static clean(text: string): string {
    const cleaned = text.replace(/[\t\r\n]+/g, " ").replace(/"/g, "'");
    return /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  }
}
