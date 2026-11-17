import { type JSX, useMemo } from "react";
import { NetClassification } from "@/domain/analysis/classification";
import type { ClassResult } from "@/domain/analysis/types";
import type { HelpTopic } from "@/ui/analytics/helpTexts";
import { useNetNames } from "@/ui/analytics/useNetNames";
import { ChipList, ElementChip, HighlightChip, VerdictCard } from "@/ui/analytics/widgets";

/**
 * The net's structural classes (Ordinary, State machine, Marked graph, Free choice), one card each.
 * State machine, marked graph and free choice require an ordinary net, as in the textbooks, so an
 * arc with a weight above 1 makes them answer "no". A failing card lists what breaks it as chips:
 * the places and transitions, and the heavy arcs, which light up on the canvas. Computed straight
 * from the live net (instant, no full analysis), so it is always current.
 */
export function ClassificationTab(): JSX.Element {
  const { net } = useNetNames();
  const classification = useMemo(() => NetClassification.classify(net), [net]);
  return (
    <div className="flex flex-col gap-3">
      <ClassCard
        title="Ordinary"
        result={classification.ordinary}
        nodesLabel="Places and transitions at their ends:"
      />
      <ClassCard title="State machine" result={classification.stateMachine} />
      <ClassCard title="Marked graph" result={classification.markedGraph} />
      <ClassCard title="Free choice" result={classification.freeChoice} />
    </div>
  );
}

function ClassCard({
  title,
  result,
  nodesLabel = "Elements that break it:",
}: {
  title: HelpTopic;
  result: ClassResult;
  nodesLabel?: string;
}): JSX.Element {
  const { net, nodeName, kindOf } = useNetNames();
  const heavy = new Set(result.erroneousArcs);
  const arcs = net.arcs.filter((a) => heavy.has(a.id));
  return (
    <VerdictCard
      title={title}
      help={title}
      verdict={result.verdict}
      detail={result.reasons[0]}
      items={result.reasons.slice(1)}
    >
      {result.erroneous.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-fg-subtle">{nodesLabel}</span>
          <ChipList>
            {result.erroneous.map((id) => (
              <ElementChip key={id} id={id} kind={kindOf(id)} name={nodeName(id)} />
            ))}
          </ChipList>
        </div>
      )}
      {arcs.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-fg-subtle">Arcs with a weight above 1:</span>
          <ChipList>
            {arcs.map((arc) => (
              <HighlightChip key={arc.id} target={{ nodes: [], arcs: [arc.id] }}>
                {`${nodeName(arc.source)} → ${nodeName(arc.target)}, weight ${arc.multiplicity}`}
              </HighlightChip>
            ))}
          </ChipList>
        </div>
      )}
    </VerdictCard>
  );
}
