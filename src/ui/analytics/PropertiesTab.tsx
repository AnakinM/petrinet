import type { JSX } from "react";
import type { AnalysisResult, Verdict } from "@/domain/analysis/types";

/**
 * Verdict chips for the net's properties. The algebraic ones (bounded-structural, conservative)
 * resolve now; the behavioural ones read `indeterminate` until the reachability pass lands.
 */
export function PropertiesTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { boundedness, conservative, live, reversible, deadlockFree } = result;
  const boundedDetail =
    boundedness.source === "structural"
      ? "A P-invariant covers every place."
      : "Requires the reachability pass.";
  return (
    <div className="flex flex-col gap-2">
      <PropertyRow
        label="Bounded"
        verdict={boundedness.bounded}
        detail={boundedness.bound !== null ? `Bound k = ${boundedness.bound}.` : boundedDetail}
      />
      <PropertyRow
        label="Safe"
        verdict={boundedness.safe}
        detail="Requires the reachability pass."
      />
      <PropertyRow
        label="Conservative"
        verdict={conservative.verdict}
        detail={conservative.detail}
      />
      <PropertyRow label="Live" verdict={live.verdict} detail={live.detail} />
      <PropertyRow label="Reversible" verdict={reversible.verdict} detail={reversible.detail} />
      <PropertyRow
        label="Deadlock-free"
        verdict={deadlockFree.verdict}
        detail={deadlockFree.detail}
      />
    </div>
  );
}

function PropertyRow({
  label,
  verdict,
  detail,
}: {
  label: string;
  verdict: Verdict;
  detail: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded border border-slate-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-700 text-sm">{label}</span>
        <VerdictPill verdict={verdict} />
      </div>
      <span className="text-slate-400 text-xs">{detail}</span>
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
