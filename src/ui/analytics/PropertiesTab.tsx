import { type JSX, type ReactNode, useMemo } from "react";
import { NOT_COMPUTED, STATE_CAP_EXCEEDED } from "@/domain/analysis/netAnalysis";
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
      <StatusCard title="Bounded" verdict={boundedness.bounded} {...boundedDetail(result)} />
      <StatusCard title="Safe" verdict={boundedness.safe} {...safeDetail(result)} />
      <StatusCard
        title="Conservative"
        verdict={conservative.verdict}
        detail={conservative.detail}
        items={conservative.items}
      />
      <StatusCard title="Live" verdict={live.verdict} detail={live.detail} items={live.items}>
        {liveSub(live, quasiLive, result.diagnostics.deadTransitions, transitionName, lit)}
      </StatusCard>
      <StatusCard
        title="Reversible"
        verdict={reversible.verdict}
        detail={reversible.detail}
        items={reversible.items}
      />
      <StatusCard
        title="Deadlock-free"
        verdict={deadlockFree.verdict}
        detail={deadlockFree.detail}
        items={deadlockFree.items}
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

/** "Stopped at the cap" vs "not yet run" both surface as an amber `indeterminate` chip; the detail says which. */
function unsettledDetail(result: AnalysisResult): string {
  return result.stateSpaceExceeded ? STATE_CAP_EXCEEDED : NOT_COMPUTED;
}

/** A detail without its verdict — the lead plus optional bullet items, spread into a {@link StatusCard}. */
type Detail = Omit<PropertyResult, "verdict">;

function boundedDetail(result: AnalysisResult): Detail {
  const { boundedness } = result;
  if (boundedness.source === "structural") {
    return boundedness.bound !== null
      ? {
          detail: "Structurally bounded:",
          items: ["A P-invariant covers every place.", `Bound k = ${boundedness.bound}.`],
        }
      : { detail: "A P-invariant covers every place." };
  }
  if (boundedness.bounded === "no") {
    return { detail: "A firing sequence pumps a place without limit, so the net is unbounded." };
  }
  if (boundedness.bounded === "yes") {
    return { detail: boundedness.bound !== null ? `Bound k = ${boundedness.bound}.` : "Bounded." };
  }
  return { detail: unsettledDetail(result) };
}

function safeDetail(result: AnalysisResult): Detail {
  const { boundedness } = result;
  if (boundedness.safe === "yes") return { detail: "Every place holds at most one token." };
  if (boundedness.safe === "no") {
    return {
      detail:
        boundedness.bound !== null
          ? `A place reaches ${boundedness.bound} tokens, so the net is not safe.`
          : "A place holds more than one token, so the net is not safe.",
    };
  }
  return { detail: unsettledDetail(result) };
}

const PILL_LABELS: Record<Verdict, string> = { yes: "Yes", no: "No", indeterminate: "Unknown" };
