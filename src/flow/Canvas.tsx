import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  ReactFlow,
  useNodesState,
} from "@xyflow/react";
import { type JSX, useMemo } from "react";
import type { PetriNet } from "@/domain/types";
import { PlaceNode } from "@/flow/nodes/PlaceNode";
import { TransitionNode } from "@/flow/nodes/TransitionNode";
import { FlowProjection, type PetriFlowNode } from "@/flow/projection";

// Stable module-level reference: recreating this each render makes React Flow warn.
const NODE_TYPES: NodeTypes = { place: PlaceNode, transition: TransitionNode };

/** The infinite-grid canvas: renders the net's nodes with pan/zoom, grid, and minimap. */
export function Canvas({ net }: { net: PetriNet }): JSX.Element {
  const initialNodes = useMemo(() => FlowProjection.toNodes(net), [net]);
  const [nodes, , onNodesChange] = useNodesState<PetriFlowNode>(initialNodes);

  return (
    <div className="h-full w-full bg-white">
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={NODE_TYPES}
        nodeOrigin={[0.5, 0.5]}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        minZoom={0.1}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background variant={BackgroundVariant.Lines} gap={24} color="#e2e8f0" />
        <MiniMap
          pannable
          zoomable
          nodeStrokeColor="#334155"
          nodeColor={(node) => (node.type === "transition" ? "#334155" : "#ffffff")}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
