import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import type { JSX } from "react";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { ARC_COLOR, type ArcFlowEdge } from "@/flow/projection";

/**
 * Custom arc edge: a straight-segment polyline drawn directly through the domain
 * arc's `points` (endpoints are stored already clipped to the node borders, so no
 * recomputation is needed for a faithful render). A closed arrowhead marks the target
 * end. The weight label shows only when `multiplicity > 1`, drawn at the polyline
 * midpoint via {@link EdgeLabelRenderer}. Endpoint/waypoint editing arrives with the
 * editing shell (it mutates the store).
 */
export function ArcEdge({ data, markerEnd }: EdgeProps<ArcFlowEdge>): JSX.Element | null {
  // `data` is always supplied by FlowProjection.toEdges; this satisfies the optional edge type.
  if (!data) return null;
  const { arc } = data;
  const path = ArcGeometry.path(arc.points);
  const weightLabel = arc.multiplicity > 1 ? ArcGeometry.midpoint(arc.points) : null;

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: ARC_COLOR, strokeWidth: 1.5 }} />
      {weightLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded border border-slate-300 bg-white px-1 font-semibold text-[11px] text-slate-700 leading-tight shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${weightLabel.x}px, ${weightLabel.y}px)`,
            }}
          >
            {arc.multiplicity}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
