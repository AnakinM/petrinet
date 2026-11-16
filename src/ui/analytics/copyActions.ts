import { AnalysisReport } from "@/domain/analysis/analysisReport";
import { MatrixFormat } from "@/domain/analysis/matrixFormat";
import { StateTableFormat } from "@/domain/analysis/stateTableFormat";
import type { StateTable } from "@/domain/analysis/types";
import { TextClipboard } from "@/lib/clipboard";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { useNoticeStore } from "@/store/noticeStore";

/** Shown when the browser refuses the clipboard (an insecure page, or the permission is off). */
export const COPY_FAILED = "The browser did not allow the copy. Nothing was copied.";

// The Analysis panel's copy buttons. Each one writes to the clipboard and confirms the copy, or its
// failure, in the notice. Call them directly in the click handler: browsers allow a clipboard write
// only during the visitor's action.

/** Confirm a clipboard write in the notice once it settles. */
function confirmCopy(write: Promise<void>, message: string): void {
  const notice = useNoticeStore.getState();
  write.then(
    () => notice.show(message),
    () => notice.show(COPY_FAILED),
  );
}

/** The whole analysis as plain text for a report, saying whether it is out of date. */
export function copyResults(): void {
  const { result, stale } = useAnalyticsStore.getState();
  if (!result) return;
  const report = AnalysisReport.build(useNetStore.getState().net, result, { stale });
  confirmCopy(TextClipboard.write(report), "Analysis results copied to the clipboard.");
}

/** The incidence matrix as a table: tab-separated text plus an HTML table. */
export function copyMatrixText(): void {
  const tsv = MatrixFormat.toText(useNetStore.getState().net);
  confirmCopy(TextClipboard.writeTable(tsv), "Incidence matrix copied to the clipboard.");
}

/** The incidence matrix as a LaTeX table. */
export function copyMatrixLatex(): void {
  const latex = MatrixFormat.toLatex(useNetStore.getState().net);
  confirmCopy(TextClipboard.write(latex), "Incidence matrix copied as LaTeX.");
}

/** Every row of the state table, not only the rows on screen, as a table. */
export function copyStateTable(table: StateTable): void {
  const tsv = StateTableFormat.toText(table, useNetStore.getState().net);
  confirmCopy(TextClipboard.writeTable(tsv), "State table copied to the clipboard.");
}
