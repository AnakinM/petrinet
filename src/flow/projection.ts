import type { Node } from "@xyflow/react";
import type { PetriNet, Place, Transition } from "@/domain/types";

/** React Flow node data payloads — each carries its source domain object verbatim. */
export type PlaceNodeData = { place: Place };
export type TransitionNodeData = { transition: Transition };

export type PlaceFlowNode = Node<PlaceNodeData, "place">;
export type TransitionFlowNode = Node<TransitionNodeData, "transition">;
export type PetriFlowNode = PlaceFlowNode | TransitionFlowNode;

/**
 * Derives the React Flow view from the domain {@link PetriNet}.
 *
 * The domain model stays the single source of truth; these nodes are a one-way
 * projection of it. Each node carries its place/transition in `data` so the custom
 * node components render straight from the domain object. Node `position` is cloned
 * (never the domain `Vec2` reference) so React Flow's internal mutations can't leak
 * back into the model. Arc edges are added in milestone 3.
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
}
