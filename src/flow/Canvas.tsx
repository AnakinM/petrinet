import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  type Connection,
  ConnectionMode,
  Controls,
  type EdgeTypes,
  MiniMap,
  type NodeTypes,
  type OnSelectionChangeParams,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import { type DragEvent, type JSX, useCallback, useEffect, useMemo } from "react";
import { NetOps } from "@/domain/netOps";
import type { PetriNet, Vec2 } from "@/domain/types";
import { ArcEdge } from "@/flow/edges/ArcEdge";
import { PlaceNode } from "@/flow/nodes/PlaceNode";
import { TransitionNode } from "@/flow/nodes/TransitionNode";
import { type ArcFlowEdge, FlowProjection, type PetriFlowNode } from "@/flow/projection";
import { useNetStore } from "@/store/netStore";
import { type PaletteNodeKind, PETRI_NODE_MIME } from "@/ui/Palette";

// Stable module-level references: recreating these each render makes React Flow warn.
const NODE_TYPES: NodeTypes = { place: PlaceNode, transition: TransitionNode };
const EDGE_TYPES: EdgeTypes = { arc: ArcEdge };

/**
 * The infinite-grid canvas. The domain net (from the store) is the single source of truth;
 * nodes/edges are re-derived from it on every change, while React Flow's local state owns
 * only transient interaction (drag position, selection highlight). Build edits map back into
 * the domain through the store: drag → `moveNodes` on release, connect → `connect`,
 * drop → `addPlace`/`addTransition`, with bipartite connections enforced by `isValidConnection`.
 */
export function Canvas(): JSX.Element {
  const net = useNetStore((s) => s.net);
  const editable = useNetStore((s) => s.mode === "build");
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<PetriFlowNode>(
    FlowProjection.toNodes(net),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<ArcFlowEdge>(FlowProjection.toEdges(net));
  const initialViewport = useMemo(() => useNetStore.getState().viewport, []);

  // Re-derive the view whenever the domain net changes (edit, undo/redo, import), preserving
  // the current selection highlight. Drags don't change the net until release, so this never
  // fights an in-progress drag.
  useEffect(() => {
    setNodes((prev) => withSelection(FlowProjection.toNodes(net), prev));
    setEdges((prev) => withSelection(FlowProjection.toEdges(net), prev));
  }, [net, setNodes, setEdges]);

  // Live arc-follow: while nodes drag, translate their magnetic arc endpoints from the domain
  // points by the live delta (recomputed from the domain each tick, so no accumulation). The
  // real geometry is committed on release; until then the store is untouched.
  const onNodeDrag = useCallback(
    (_event: unknown, _node: PetriFlowNode, draggedNodes: PetriFlowNode[]) => {
      const current = useNetStore.getState().net;
      const moved = new Map(draggedNodes.map((n) => [n.id, n.position]));
      setEdges((prev) =>
        prev.map((edge) => {
          const arc = current.arcs.find((a) => a.id === edge.id);
          if (!arc) return edge;
          const src = arc.srcMagnetic ? moved.get(arc.source) : undefined;
          const dst = arc.destMagnetic ? moved.get(arc.target) : undefined;
          if (!src && !dst) return edge;
          const last = arc.points.length - 1;
          const points = arc.points.map((p, i) => {
            if (i === 0 && src) return shift(p, src, center(current, arc.source));
            if (i === last && dst) return shift(p, dst, center(current, arc.target));
            return p;
          });
          return { ...edge, data: { arc: { ...arc, points } } };
        }),
      );
    },
    [setEdges],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: PetriFlowNode, draggedNodes: PetriFlowNode[]) => {
      useNetStore
        .getState()
        .moveNodes(draggedNodes.map((n) => ({ id: n.id, position: n.position })));
    },
    [],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    useNetStore.getState().select({
      nodes: params.nodes.map((n) => n.id),
      edges: params.edges.map((e) => e.id),
    });
  }, []);

  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target) useNetStore.getState().connect(c.source, c.target);
  }, []);

  const isValidConnection = useCallback(
    (c: Connection | ArcFlowEdge): boolean =>
      !!c.source && !!c.target && NetOps.canConnect(useNetStore.getState().net, c.source, c.target),
    [],
  );

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    useNetStore.getState().setViewport(viewport);
  }, []);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(PETRI_NODE_MIME) as PaletteNodeKind;
      if (kind !== "place" && kind !== "transition") return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const store = useNetStore.getState();
      if (kind === "place") store.addPlace(position);
      else store.addTransition(position);
    },
    [screenToFlowPosition],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target for palette drag-create; all pointer interaction is React Flow's pane below.
    <div className="h-full w-full bg-white" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onMoveEnd={onMoveEnd}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        connectionMode={ConnectionMode.Loose}
        nodeOrigin={[0.5, 0.5]}
        nodesDraggable={editable}
        nodesConnectable={editable}
        elementsSelectable={editable}
        deleteKeyCode={null}
        panOnScroll
        minZoom={0.1}
        maxZoom={4}
        {...(initialViewport
          ? { defaultViewport: initialViewport }
          : { fitView: true, fitViewOptions: { padding: 0.2 } })}
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

/** Carry forward React Flow's selection highlight by id when re-deriving from the domain. */
function withSelection<T extends { id: string; selected?: boolean }>(next: T[], prev: T[]): T[] {
  const selected = new Set(prev.filter((p) => p.selected).map((p) => p.id));
  if (selected.size === 0) return next;
  return next.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
}

/** Translate a stored point by (live − domain) of its node center. */
function shift(point: Vec2, live: Vec2, domain: Vec2): Vec2 {
  return { x: point.x + (live.x - domain.x), y: point.y + (live.y - domain.y) };
}

function center(net: PetriNet, id: string): Vec2 {
  const node = net.places.find((p) => p.id === id) ?? net.transitions.find((t) => t.id === id);
  return node?.position ?? { x: 0, y: 0 };
}
