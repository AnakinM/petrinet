import type { JSX } from "react";
import { UNBOUNDED_NOTE } from "@/domain/analysis/analysisReport";
import { STATE_CAP_EXCEEDED } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, StateRow, StateTable } from "@/domain/analysis/types";
import { type Spotlight, useAnalyticsStore } from "@/store/analyticsStore";
import { copyStateTable } from "@/ui/analytics/copyActions";
import { ReachabilityQuery } from "@/ui/analytics/ReachabilityQuery";
import { useNetNames } from "@/ui/analytics/useNetNames";
import {
  Card,
  CopyButton,
  CountMark,
  Note,
  PendingBadge,
  useHoverPreview,
} from "@/ui/analytics/widgets";

/** The most state table rows the panel draws. "Copy table" still copies every row. */
export const STATE_ROWS_SHOWN = 200;

/** Reachability: ask about one marking, and list every reachable marking after the full analysis. */
export function ReachabilityTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { net } = useNetNames();
  return (
    <div className="flex flex-col gap-3">
      <ReachabilityQuery net={net} />
      <StateTableCard result={result} />
    </div>
  );
}

/**
 * The reachable markings M0, M1, ... in order of discovery, with the firings out of each. Deadlocks
 * are marked, and a marking the search never finished says "not explored" rather than looking
 * stuck. A click on a row lights the places that hold tokens in it.
 */
function StateTableCard({ result }: { result: AnalysisResult }): JSX.Element {
  const table = result.stateTable;
  const total = table?.rows.length ?? 0;
  return (
    <Card
      title="State table"
      help="State table"
      mark={
        table === null ? (
          <PendingBadge />
        ) : (
          <CountMark>
            {total.toLocaleString("en-US")} marking{total === 1 ? "" : "s"}
          </CountMark>
        )
      }
    >
      {table !== null && (
        <>
          {!table.complete && (
            <p className="text-warning-fg">
              {result.stateSpaceExceeded ? STATE_CAP_EXCEEDED : UNBOUNDED_NOTE} The table shows only
              the explored part.
            </p>
          )}
          <StateRows table={table} />
          {total > STATE_ROWS_SHOWN && (
            <Note>
              Showing the first {STATE_ROWS_SHOWN} of {total.toLocaleString("en-US")} markings. Copy
              table copies all of them.
            </Note>
          )}
          <div>
            <CopyButton onClick={() => copyStateTable(table)}>Copy table</CopyButton>
          </div>
        </>
      )}
    </Card>
  );
}

function StateRows({ table }: { table: StateTable }): JSX.Element {
  const { placeName, transitionName } = useNetNames();
  const litKey = useAnalyticsStore((s) => s.highlightKey);
  return (
    <div className="max-h-96 overflow-auto rounded border border-line">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <HeaderCell sticky>Marking</HeaderCell>
            {table.placeIds.map((id) => (
              <HeaderCell key={id} numeric>
                {placeName(id)}
              </HeaderCell>
            ))}
            <HeaderCell>Firings</HeaderCell>
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(0, STATE_ROWS_SHOWN).map((row) => (
            <StateRowView
              key={row.name}
              row={row}
              table={table}
              litKey={litKey}
              transitionName={transitionName}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A column heading. It stays at the top while the table scrolls; `sticky` keeps it at the left too. */
function HeaderCell({
  numeric = false,
  sticky = false,
  children,
}: {
  numeric?: boolean;
  sticky?: boolean;
  children: string;
}): JSX.Element {
  return (
    <th
      scope="col"
      className={`sticky top-0 whitespace-nowrap border-line border-b bg-surface-subtle px-2 py-1 font-medium text-fg ${numeric ? "text-right" : "text-left"} ${sticky ? "left-0 z-20 border-r" : "z-10"}`}
    >
      {children}
    </th>
  );
}

/**
 * One marking. Resting the mouse on a row lights its marked places at once; a click keeps them lit
 * and pans the canvas there. The name cell is a button, so a keyboard reaches the row too. Each row
 * owns its highlight, so two markings with the same marked places are pressed one at a time.
 */
function StateRowView({
  row,
  table,
  litKey,
  transitionName,
}: {
  row: StateRow;
  table: StateTable;
  litKey: string | null;
  transitionName: (id: string) => string;
}): JSX.Element {
  const marked = table.placeIds.filter((_, i) => row.tokens[i] > 0);
  const target: Spotlight = { nodes: marked, arcs: [] };
  const key = `state:${row.name}`;
  const hover = useHoverPreview(target);
  const clickable = marked.length > 0;
  const active = clickable && key === litKey;
  const cell = "border-line-subtle border-b px-2 py-1 align-top";
  return (
    <tr
      // The name cell holds a button whose click bubbles here, which gives the keyboard access.
      onClick={
        clickable ? () => useAnalyticsStore.getState().toggleHighlight(target, key) : undefined
      }
      {...(clickable ? hover : {})}
      className={`group ${clickable ? "cursor-pointer hover:bg-highlight-soft" : ""} ${active ? "bg-highlight-soft" : ""}`}
    >
      {/* The name stays in view while the table scrolls sideways to the firings. */}
      <td
        className={`${cell} sticky left-0 z-[5] whitespace-nowrap border-r border-r-line font-mono ${active ? "bg-highlight-soft" : "bg-surface"} ${clickable ? "group-hover:bg-highlight-soft" : ""}`}
      >
        {clickable ? (
          <button
            type="button"
            aria-pressed={active}
            className={`rounded px-1 font-mono ${active ? "bg-highlight-tint text-highlight-fg" : "text-fg-strong underline decoration-line-strong underline-offset-2"}`}
          >
            {row.name}
          </button>
        ) : (
          <span className="px-1">{row.name}</span>
        )}
      </td>
      {row.tokens.map((n, i) => (
        <td
          key={table.placeIds[i]}
          className={`${cell} text-right font-mono ${n === 0 ? "text-fg-faint" : "text-fg-strong"}`}
        >
          {n}
        </td>
      ))}
      <td className={`${cell} min-w-40`}>
        {!row.explored ? (
          <span className="text-fg-subtle italic">not explored</span>
        ) : row.deadlock ? (
          <span className="rounded bg-danger-tint px-1.5 py-0.5 font-medium text-danger-fg-strong">
            deadlock
          </span>
        ) : (
          row.firings
            .map((f) => `${transitionName(f.transition)} to ${table.rows[f.to].name}`)
            .join("; ")
        )}
      </td>
    </tr>
  );
}
