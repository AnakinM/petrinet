import { type Edge, MarkerType, type Node } from "@xyflow/react";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

/** React Flow node data payloads — each carries its source domain object verbatim. */
export type PlaceNodeData = { place: Place };
export type TransitionNodeData = { transition: Transition };

export type PlaceFlowNode = Node<PlaceNodeData, "place">;
export type TransitionFlowNode = Node<TransitionNodeData, "transition">;
export type PetriFlowNode = PlaceFlowNode | TransitionFlowNode;

/** React Flow edge payload — carries its source {@link Arc} verbatim. */
export type ArcEdgeData = { arc: Arc };
export type ArcFlowEdge = Edge<ArcEdgeData, "arc">;

/** Stroke + arrowhead colour for arcs (slate-700), shared by the projection and the edge. */
export const ARC_COLOR = "#334155";

/**
 * Derives the React Flow view from the domain {@link PetriNet}.
 *
 * The domain model stays the single source of truth; these nodes and edges are a one-way
 * projection of it. Each node carries its place/transition in `data` so the custom
 * node components render straight from the domain object. Node `position` is cloned
 * (never the domain `Vec2` reference) so React Flow's internal mutations can't leak
 * back into the model.
 */
export class FlowProjection {
  static toNodes(net: PetriNet): PetriFlowNode[] {
    const places = net.places.map(
      (place): PlaceFlowNode => ({
        id: place.id,
        type: "place",
        position: { x: place.position.x, y: place.position.y },
        data: { place },
      }),
    );
    const transitions = net.transitions.map(
      (transition): TransitionFlowNode => ({
        id: transition.id,
        type: "transition",
        position: { x: transition.position.x, y: transition.position.y },
        data: { transition },
      }),
    );
    return [...places, ...transitions];
  }

  /**
   * Projects each domain {@link Arc} to a React Flow edge of the custom `arc` type.
   * The arc travels in `data` verbatim; {@link ArcEdge} draws the stored polyline
   * directly (the endpoints are already clipped to the node borders). The arrowhead
   * is a closed marker at the target end.
   */
  static toEdges(net: PetriNet): ArcFlowEdge[] {
    return net.arcs.map(
      (arc): ArcFlowEdge => ({
        id: arc.id,
        source: arc.source,
        target: arc.target,
        type: "arc",
        data: { arc },
        markerEnd: { type: MarkerType.ArrowClosed, color: ARC_COLOR, width: 18, height: 18 },
      }),
    );
  }
}
