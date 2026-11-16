/** Cleans a name for a tab-separated cell so a spreadsheet keeps every cell where it belongs. */
export class TsvCell {
  /** Tabs and line breaks become spaces; double quotes become single quotes (a leading quote merges cells). */
  static clean(text: string): string {
    return text.replace(/[\t\r\n]+/g, " ").replace(/"/g, "'");
  }
}
