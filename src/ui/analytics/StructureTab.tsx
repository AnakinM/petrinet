import type { JSX } from "react";
import type { AnalysisResult } from "@/domain/analysis/types";
import { useNetNames } from "@/ui/analytics/useNetNames";
import {
  Card,
  CountMark,
  ElementChip,
  ElementMark,
  HighlightChip,
  Note,
} from "@/ui/analytics/widgets";

/**
 * The shape of the net, from the always-on structural pass: its loops and its basic facts. Every
 * element is a chip that lights it on the canvas.
 */
export function StructureTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { net, nodeName, kindOf } = useNetNames();
  const d = result.diagnostics;
  const totalNodes = net.places.length + net.transitions.length;
  const loops = d.cyclicComponents.length;

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Loops"
        help="Loops"
        mark={
          <CountMark>{d.acyclic ? "Acyclic" : `${loops} loop${loops === 1 ? "" : "s"}`}</CountMark>
        }
      >
        {d.acyclic ? (
          <p>No element lies on a loop.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              {d.cyclicComponents.map((c) => (
                <HighlightChip key={c.join(",")} target={{ nodes: c, arcs: [] }} layout="row">
                  {/* A loop is an unordered set of elements: commas, not arrows (which would imply a path). */}
                  <span className="flex flex-wrap items-center gap-x-1">
                    {c.map((id, i) => (
                      <span key={id} className="inline-flex items-center gap-1">
                        <ElementMark kind={kindOf(id)} />
                        {nodeName(id)}
                        {i < c.length - 1 && ","}
                      </span>
                    ))}
                  </span>
                </HighlightChip>
              ))}
            </div>
            <Note>{cycleCoverage(d.cyclicComponents, totalNodes)}</Note>
          </>
        )}
      </Card>

      <Card title="Net facts" help="Net facts">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-600">Connected</dt>
            <dd>{d.connected ? "Yes" : "No"}</dd>
          </div>
          <FactChips label="Source places" ids={d.sourcePlaces} />
          <FactChips label="Sink places" ids={d.sinkPlaces} />
          <FactChips label="Source transitions" ids={d.sourceTransitions} />
          <FactChips label="Sink transitions" ids={d.sinkTransitions} />
          <FactChips label="Isolated" ids={d.isolated} />
        </dl>
      </Card>
    </div>
  );
}

/** A net-fact row whose members are individually clickable chips ("none" when empty). */
function FactChips({ label, ids }: { label: string; ids: string[] }): JSX.Element {
  const { nodeName, kindOf } = useNetNames();
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 pt-0.5 text-slate-600">{label}</dt>
      {ids.length === 0 ? (
        <dd>none</dd>
      ) : (
        <dd className="flex flex-wrap justify-end gap-1">
          {ids.map((id) => (
            <ElementChip key={id} id={id} kind={kindOf(id)} name={nodeName(id)} />
          ))}
        </dd>
      )}
    </div>
  );
}

/**
 * One-line cycle-coverage summary from the SCC decomposition: how many elements lie on a loop (are in
 * a strongly connected component of size > 1) out of the whole net, and how many such loops.
 */
function cycleCoverage(components: string[][], totalNodes: number): string {
  const onCycle = new Set(components.flat()).size;
  const pct = totalNodes === 0 ? 0 : Math.round((100 * onCycle) / totalNodes);
  return `${onCycle} of ${totalNodes} element${totalNodes === 1 ? "" : "s"} (${pct}%) lie on a loop.`;
}
