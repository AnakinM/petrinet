import { type JSX, type ReactNode, useMemo } from "react";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, PropertyResult, Verdict } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { DISPLAY_CAP, HighlightChip, StatusCard } from "@/ui/analytics/widgets";

/**
 * Status + Reasons cards for the net's properties. The algebraic ones (structural boundedness,
 * conservative) resolve from the live slice; the behavioural ones (safe, live, reversible,
 * deadlock-free) read `indeterminate` until the on-demand reachability pass runs, then carry a
 * one-line witness with bulleted reasons.
 */
export function PropertiesTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { boundedness, conservative, live, quasiLive, reversible, deadlockFree } = result;
  const transitions = useNetStore((s) => s.net).transitions;
  const transitionName = useMemo(() => NetNames.resolver(transitions), [transitions]);
  const lit = useAnalyticsStore((s) => s.highlight).join(",");
  return (
    <div className="flex flex-col gap-2">
      <StatusCard
        title="Bounded"
        verdict={boundedness.bounded}
        help="Bounded if some finite k caps the tokens in every place across all reachable markings, so no place can grow without limit."
        {...NetAnalysis.boundedDetail(result)}
      />
      <StatusCard
        title="Safe"
        verdict={boundedness.safe}
        help="Safe (1-bounded) if no reachable marking ever puts more than one token in any place."
        {...NetAnalysis.safeDetail(result)}
      />
      <StatusCard
        title="Conservative"
        verdict={conservative.verdict}
        detail={conservative.detail}
        items={conservative.items}
        help="Conservative if a positive place weighting keeps the weighted token total constant under every firing; strictly conservative if the plain token count never changes."
      />
      <StatusCard
        title="Live"
        verdict={live.verdict}
        detail={live.detail}
        items={live.items}
        help="Live if, from every reachable marking, each transition can eventually be made to fire again, so none becomes permanently dead."
      >
        {liveSub(live, quasiLive, result.diagnostics.deadTransitions, transitionName, lit)}
      </StatusCard>
      <StatusCard
        title="Reversible"
        verdict={reversible.verdict}
        detail={reversible.detail}
        items={reversible.items}
        help="Reversible if the initial marking M0 is reachable again from every reachable marking."
      />
      <StatusCard
        title="Deadlock-free"
        verdict={deadlockFree.verdict}
        detail={deadlockFree.detail}
        items={deadlockFree.items}
        help="Deadlock-free if every reachable marking enables at least one transition, so the net never fully stalls."
      />
    </div>
  );
}

/**
 * The Live card's quasi-live sub-note. When a transition never fires its name becomes a chip that
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
  if (quasiLive.verdict !== "no" || dead.length === 0) {
    return <span className="text-slate-500 text-xs">{`${prefix}. ${quasiLive.detail}`}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1 text-slate-500 text-xs">
      <span>{prefix}. Never fires:</span>
      {dead.slice(0, DISPLAY_CAP).map((id) => (
        <HighlightChip key={id} ids={[id]} lit={lit} size="chip">
          {transitionName(id)}
        </HighlightChip>
      ))}
      {dead.length > DISPLAY_CAP && <span>and {dead.length - DISPLAY_CAP} more.</span>}
    </span>
  );
}

const PILL_LABELS: Record<Verdict, string> = { yes: "Yes", no: "No", indeterminate: "Unknown" };
