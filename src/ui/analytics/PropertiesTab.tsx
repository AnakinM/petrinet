import { type JSX, type ReactNode, useMemo } from "react";
import { NOT_COMPUTED, STATE_CAP_EXCEEDED } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, PropertyResult, Verdict } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { DISPLAY_CAP, HighlightChip } from "@/ui/analytics/widgets";

/**
 * Verdict chips for the net's properties. The algebraic ones (structural boundedness, conservative)
 * resolve from the live slice; the behavioural ones (safe, live, reversible, deadlock-free) read
 * `indeterminate` until the on-demand reachability pass runs, then carry a one-line witness.
 */
export function PropertiesTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { boundedness, conservative, live, quasiLive, reversible, deadlockFree } = result;
  const transitions = useNetStore((s) => s.net).transitions;
  const transitionName = useMemo(() => NetNames.resolver(transitions), [transitions]);
  const lit = useAnalyticsStore((s) => s.highlight).join(",");
  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label="Bounded" verdict={boundedness.bounded} detail={boundedDetail(result)} />
      <PropertyRow label="Safe" verdict={boundedness.safe} detail={safeDetail(result)} />
      <PropertyRow
        label="Conservative"
        verdict={conservative.verdict}
        detail={conservative.detail}
      />
      <PropertyRow
        label="Live"
        verdict={live.verdict}
        detail={live.detail}
        sub={liveSub(live, quasiLive, result.diagnostics.deadTransitions, transitionName, lit)}
      />
      <PropertyRow label="Reversible" verdict={reversible.verdict} detail={reversible.detail} />
      <PropertyRow
        label="Deadlock-free"
        verdict={deadlockFree.verdict}
        detail={deadlockFree.detail}
      />
    </div>
  );
}

/**
 * The Live row's quasi-live sub-note. When a transition never fires its name becomes a chip that
 * spotlights it on the canvas (ids from the structured diagnostics, not the detail text). The list
 * is clipped to {@link DISPLAY_CAP} so it agrees with the Structure tab's dead-transition list.
 */
function liveSub(
  live: PropertyResult,
  quasiLive: PropertyResult,
  dead: string[],
  transitionName: (id: string) => string,
  lit: string,
): ReactNode {
  if (live.verdict === "yes") return undefined;
  const prefix = `Quasi-live: ${PILL_LABELS[quasiLive.verdict].toLowerCase()}`;
  if (quasiLive.verdict !== "no" || dead.length === 0) return `${prefix} — ${quasiLive.detail}`;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span>{prefix} — never fires:</span>
      {dead.slice(0, DISPLAY_CAP).map((id) => (
        <HighlightChip key={id} ids={[id]} lit={lit} size="chip">
          {transitionName(id)}
        </HighlightChip>
      ))}
      {dead.length > DISPLAY_CAP && <span>and {dead.length - DISPLAY_CAP} more.</span>}
    </span>
  );
}

/** "Stopped at the cap" vs "not yet run" both surface as an amber `indeterminate` chip; the detail says which. */
function unsettledDetail(result: AnalysisResult): string {
  return result.stateSpaceExceeded ? STATE_CAP_EXCEEDED : NOT_COMPUTED;
}

function boundedDetail(result: AnalysisResult): string {
  const { boundedness } = result;
  if (boundedness.source === "structural") {
    return boundedness.bound !== null
      ? `A P-invariant covers every place; bound k = ${boundedness.bound}.`
      : "A P-invariant covers every place.";
  }
  if (boundedness.bounded === "no") {
    return "Unbounded — a firing sequence pumps a place without limit.";
  }
  if (boundedness.bounded === "yes") {
    return boundedness.bound !== null ? `Bound k = ${boundedness.bound}.` : "Bounded.";
  }
  return unsettledDetail(result);
}

function safeDetail(result: AnalysisResult): string {
  const { boundedness } = result;
  if (boundedness.safe === "yes") return "Every place holds at most one token.";
  if (boundedness.safe === "no") {
    return boundedness.bound !== null
      ? `Not safe — a place reaches ${boundedness.bound} tokens.`
      : "Not safe — a place holds more than one token.";
  }
  return unsettledDetail(result);
}

function PropertyRow({
  label,
  verdict,
  detail,
  sub,
}: {
  label: string;
  verdict: Verdict;
  detail: string;
  sub?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-slate-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-700 text-sm">{label}</span>
        <VerdictPill verdict={verdict} />
      </div>
      <span className="text-slate-400 text-xs">{detail}</span>
      {sub && <span className="text-slate-400 text-xs">{sub}</span>}
    </div>
  );
}

const PILL_STYLES: Record<Verdict, string> = {
  yes: "border-green-200 bg-green-100 text-green-700",
  no: "border-red-200 bg-red-100 text-red-700",
  indeterminate: "border-amber-200 bg-amber-100 text-amber-700",
};
const PILL_LABELS: Record<Verdict, string> = { yes: "Yes", no: "No", indeterminate: "Unknown" };

function VerdictPill({ verdict }: { verdict: Verdict }): JSX.Element {
  return (
    <span className={`rounded border px-1.5 py-0.5 font-medium text-xs ${PILL_STYLES[verdict]}`}>
      {PILL_LABELS[verdict]}
    </span>
  );
}
