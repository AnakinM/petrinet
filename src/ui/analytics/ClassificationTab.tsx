import { type JSX, useMemo } from "react";
import { NetClassification } from "@/domain/analysis/classification";
import type { ClassResult } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { HighlightChip, StatusCard } from "@/ui/analytics/widgets";

/**
 * The net's structural classifications (Ordinary / State machine / Marked graph / Free choice), each
 * a Status + Reasons card. When a class fails, its erroneous elements are listed as click-to-spotlight
 * chips. Computed straight from the live net (instant, no behavioural pass), so it is always current.
 */
export function ClassificationTab(): JSX.Element {
  const net = useNetStore((s) => s.net);
  const lit = useAnalyticsStore((s) => s.highlight).join(",");
  const classification = useMemo(() => NetClassification.classify(net), [net]);
  const nameOf = useMemo(() => NetNames.resolver([...net.places, ...net.transitions]), [net]);
  return (
    <div className="flex flex-col gap-2">
      <ClassCard
        title="Ordinary"
        help="An ordinary net has every arc weight equal to 1 — no multiplicities."
        result={classification.ordinary}
        nameOf={nameOf}
        lit={lit}
      />
      <ClassCard
        title="State machine"
        help="A state machine has every transition with exactly one input place and one output place — no synchronisation or splitting."
        result={classification.stateMachine}
        nameOf={nameOf}
        lit={lit}
      />
      <ClassCard
        title="Marked graph"
        help="A marked graph (T-net) has every place with exactly one input transition and one output transition — no choice."
        result={classification.markedGraph}
        nameOf={nameOf}
        lit={lit}
      />
      <ClassCard
        title="Free choice"
        help="A free-choice net never forces a conflict: wherever a place feeds several transitions, those transitions have no other input places."
        result={classification.freeChoice}
        nameOf={nameOf}
        lit={lit}
      />
    </div>
  );
}

function ClassCard({
  title,
  help,
  result,
  nameOf,
  lit,
}: {
  title: string;
  help: string;
  result: ClassResult;
  nameOf: (id: string) => string;
  lit: string;
}): JSX.Element {
  return (
    <StatusCard
      title={title}
      verdict={result.verdict}
      detail={result.reasons[0]}
      items={result.reasons.slice(1)}
      help={help}
    >
      {result.erroneous.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-slate-400 text-xs">Erroneous elements</span>
          <div className="flex flex-wrap gap-1">
            {result.erroneous.map((id) => (
              <HighlightChip key={id} ids={[id]} lit={lit} size="chip">
                {nameOf(id)}
              </HighlightChip>
            ))}
          </div>
        </div>
      )}
    </StatusCard>
  );
}
