import type { JSX } from "react";
import { NOT_COMPUTED, STATE_CAP_EXCEEDED } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, Verdict } from "@/domain/analysis/types";

/**
 * Verdict chips for the net's properties. The algebraic ones (structural boundedness, conservative)
 * resolve from the live slice; the behavioural ones (safe, live, reversible, deadlock-free) read
 * `indeterminate` until the on-demand reachability pass runs, then carry a one-line witness.
 */
export function PropertiesTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { boundedness, conservative, live, quasiLive, reversible, deadlockFree } = result;
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
        sub={
          live.verdict !== "yes"
            ? `Quasi-live: ${PILL_LABELS[quasiLive.verdict].toLowerCase()} — ${quasiLive.detail}`
            : undefined
        }
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
  sub?: string;
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
