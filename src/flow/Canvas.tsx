import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  type EdgeTypes,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  type OnSelectionChangeParams,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Viewport,
} from "@xyflow/react";
import {
  type CSSProperties,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AlignmentGuides, type Guide } from "@/domain/alignment";
import { GridSnap } from "@/domain/gridSnap";
import { NetOps } from "@/domain/netOps";
import type { PetriNet, Vec2 } from "@/domain/types";
import { AlignmentGuideLayer } from "@/flow/AlignmentGuideLayer";
import { ArcDrawLayer } from "@/flow/ArcDrawLayer";
import { ArcEdge } from "@/flow/edges/ArcEdge";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { PlaceNode } from "@/flow/nodes/PlaceNode";
import { TransitionNode } from "@/flow/nodes/TransitionNode";
import { PlacingLayer } from "@/flow/PlacingLayer";
import { type ArcFlowEdge, FlowProjection, type PetriFlowNode } from "@/flow/projection";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

// Stable module-level references: recreating these each render makes React Flow warn.
const NODE_TYPES: NodeTypes = { place: PlaceNode, transition: TransitionNode };
const EDGE_TYPES: EdgeTypes = { arc: ArcEdge };

// Amber ring + soft glow an analytics highlight paints onto a node wrapper. Purely a `style`
// overlay (untouched by the projection), so it layers cleanly over selection and survives Simulate.
const HIGHLIGHT_STYLE: CSSProperties = {
  boxShadow: "0 0 0 3px #f59e0b, 0 0 18px 6px rgba(245, 158, 11, 0.45)",
  zIndex: 5,
};

// Right-click within this many screen px of a selected arc's bend removes it (A5 rule 3).
// Comfortably larger than the 10px waypoint handle so the target stays forgiving.
const BEND_HIT_SCREEN_PX = 12;

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
  const drawing = useBuildStore((s) => s.draft !== null);
  const tool = useBuildStore((s) => s.tool);
  const snap = useBuildStore((s) => s.snap);
  // Tools only act in Build; this also keeps a left-over placing tool from bleeding into Simulate.
  const placing = editable && (tool === "place" || tool === "transition");
  const marquee = editable && tool === "select";
  // Token tool: places become pure click targets (selection + drag suppressed below), so a click
  // can't nudge or select them. onNodeClick edits M0; onNodeClick's presence also keeps the node
  // wrappers clickable (RF gives them pointer-events when a click handler exists).
  const tokenTool = editable && tool === "token";
  const highlight = useAnalyticsStore((s) => s.highlight);
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<PetriFlowNode>(
    FlowProjection.toNodes(net),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<ArcFlowEdge>(FlowProjection.toEdges(net));
  const [dragGuides, setDragGuides] = useState<Guide[]>([]);
  const initialViewport = useMemo(() => useNetStore.getState().viewport, []);

  // Re-derive the view whenever the domain net changes (edit, undo/redo, import), preserving
  // the current selection and analytics highlight. Drags don't change the net until release, so
  // this never fights an in-progress drag. The highlight is read imperatively (its own effect
  // below tracks changes), so a layout nudge re-paints the glow on the moved node.
  useEffect(() => {
    const lit = new Set(useAnalyticsStore.getState().highlight);
    // Project the domain selection (netStore) onto React Flow. Carrying the *domain* selection
    // rather than RF's previous flags is what lets a paste preselect its brand-new ids — they were
    // never selected in RF before, but netStore.paste set them. RF mirrors back via
    // onSelectionChange, a stable fixpoint since this effect only re-runs on a net change.
    const { nodes: selNodes, edges: selEdges } = useNetStore.getState().selection;
    const nodeSel = new Set(selNodes);
    const edgeSel = new Set(selEdges);
    setNodes(withHighlight(withSelection(FlowProjection.toNodes(net), nodeSel), lit));
    setEdges(withSelection(FlowProjection.toEdges(net), edgeSel));
  }, [net, setNodes, setEdges]);

  // Paint the analytics highlight onto the matching nodes and frame them — clicking a diagnostic
  // (a dead transition, a loop, a source place) spotlights it and pans it into view, wherever it is.
  // The panel overlays the canvas's right edge, so reserve its width as right padding; otherwise a
  // framed node would centre under the panel and stay hidden.
  useEffect(() => {
    const lit = new Set(highlight);
    setNodes((prev) => withHighlight(prev, lit));
    if (highlight.length > 0) {
      const { open, width } = useAnalyticsStore.getState();
      fitView({
        nodes: highlight.map((id) => ({ id })),
        duration: 400,
        maxZoom: 1.5,
        padding: {
          top: "40px",
          bottom: "40px",
          left: "40px",
          right: `${open ? width + 40 : 40}px`,
        },
      });
    }
  }, [highlight, setNodes, fitView]);

  // In the marquee (select) tool, Esc clears the current selection (right-click clears it via the
  // A5 context-menu policy). Other tools own Esc themselves (exit placing / cancel an arc draw).
  useEffect(() => {
    if (!marquee) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setNodes(clearSelected);
      setEdges(clearSelected);
      useNetStore.getState().select({ nodes: [], edges: [] });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marquee, setNodes, setEdges]);

  // Resolve a node's live position to the grid/alignment (B2+B3). A lone drag aligns to its
  // siblings and surfaces guides; a group drag falls back to plain snap. Only position changes
  // carry a center; arc bends are dragged through their own waypoint handlers, so they stay
  // freeform.
  const handleNodesChange = useCallback(
    (changes: NodeChange<PetriFlowNode>[]) => {
      const positions = changes.flatMap((c) =>
        c.type === "position" && c.position
          ? [{ change: c, id: c.id, position: c.position, dragging: c.dragging }]
          : [],
      );
      if (positions.length === 1) {
        const pc = positions[0];
        const { position, guides } = AlignmentGuides.resolve(
          pc.position,
          NetOps.nodeCenters(useNetStore.getState().net, pc.id),
          snap,
        );
        setDragGuides(pc.dragging ? guides : []);
        onNodesChange(changes.map((c) => (c === pc.change ? { ...c, position } : c)));
        return;
      }
      setDragGuides((g) => (g.length === 0 ? g : []));
      onNodesChange(
        snap
          ? changes.map((c) =>
              c.type === "position" && c.position
                ? { ...c, position: GridSnap.snap(c.position) }
                : c,
            )
          : changes,
      );
    },
    [onNodesChange, snap],
  );

  // Live arc-follow: while nodes drag, translate their magnetic arc endpoints from the domain
  // points by the live delta (recomputed from the domain each tick, so no accumulation). The
  // real geometry is committed on release; until then the store is untouched.
  const onNodeDrag = useCallback(
    (_event: unknown, _node: PetriFlowNode, draggedNodes: PetriFlowNode[]) => {
      const current = useNetStore.getState().net;
      const single = draggedNodes.length === 1;
      const moved = new Map(
        draggedNodes.map((n) => [n.id, dragCenter(current, n.id, n.position, snap, single)]),
      );
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
    [setEdges, snap],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, _node: PetriFlowNode, draggedNodes: PetriFlowNode[]) => {
      const net = useNetStore.getState().net;
      const single = draggedNodes.length === 1;
      useNetStore.getState().moveNodes(
        draggedNodes.map((n) => ({
          id: n.id,
          position: dragCenter(net, n.id, n.position, snap, single),
        })),
      );
      setDragGuides([]);
    },
    [snap],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    useNetStore.getState().select({
      nodes: params.nodes.map((n) => n.id),
      edges: params.edges.map((e) => e.id),
    });
  }, []);

  // Token tool: clicking a place adds a token, shift-click removes one (mirrors the Simulate place).
  // `setTokens` clamps at 0, so shift-click at 0 is a safe no-op. Clicks on transitions are ignored.
  // The tool is Build-only (it resets to idle on entering Simulate), so the tool check is sufficient.
  const onNodeClick = useCallback((event: ReactMouseEvent, node: PetriFlowNode): void => {
    if (useBuildStore.getState().tool !== "token") return;
    const place = useNetStore.getState().net.places.find((p) => p.id === node.id);
    if (!place) return;
    useNetStore.getState().setTokens(place.id, place.tokens + (event.shiftKey ? -1 : 1));
  }, []);

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    useNetStore.getState().setViewport(viewport);
  }, []);

  // Unified right-click policy (A5). Mounted on the canvas wrapper so it suppresses the native
  // menu canvas-only (the side panels are separate DOM subtrees) and catches every target —
  // pane, node, edge, and the waypoint handles in the edge-label layer that RF's
  // onEdgeContextMenu would miss. Rules 1 (cancel an in-progress draw) and 2 (exit a placing tool)
  // are handled upstream by the ArcDrawLayer / PlacingLayer overlays, which stop the event before
  // it reaches here; this handler covers rules 3–5.
  const onContextMenu = useCallback(
    (event: ReactMouseEvent): void => {
      event.preventDefault();
      const { net, selection, mode } = useNetStore.getState();
      if (mode !== "build") return;

      // Rule 3: cursor on a selected arc's bend → remove that bend and straighten.
      const cursor = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const tolerance = BEND_HIT_SCREEN_PX / getViewport().zoom;
      for (const edgeId of selection.edges) {
        const arc = net.arcs.find((a) => a.id === edgeId);
        if (!arc) continue;
        const index = ArcGeometry.bendAt(arc.points, cursor, tolerance);
        if (index !== null) {
          useNetStore.getState().removeWaypoint(arc.id, index);
          return;
        }
      }

      // Rule 4: anything selected → clear it. Rule 5 (nothing selected) falls through to a no-op.
      if (selection.nodes.length > 0 || selection.edges.length > 0) {
        setNodes(clearSelected);
        setEdges(clearSelected);
        useNetStore.getState().select({ nodes: [], edges: [] });
      }
    },
    [screenToFlowPosition, getViewport, setNodes, setEdges],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas-only right-click policy; all other pointer interaction is React Flow's pane below.
    <div className="relative h-full w-full bg-white" onContextMenu={onContextMenu}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onMoveEnd={onMoveEnd}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        connectionMode={ConnectionMode.Loose}
        nodeOrigin={[0.5, 0.5]}
        nodesDraggable={editable && !tokenTool}
        nodesConnectable={false}
        elementsSelectable={editable && !tokenTool}
        // Zoom-on-double-click only with no tool active (idle Build). Any active tool turns a place
        // into a rapid click target (e.g. Token add) and Simulate fires transitions on click, so a
        // fast double-click there must not be hijacked into a zoom.
        zoomOnDoubleClick={editable && tool === "idle"}
        deleteKeyCode={null}
        panOnScroll
        // Marquee (select) tool: left-drag the empty pane rubber-bands nodes (a drag on a selected
        // node moves the group), while the middle button still pans. Other modes pan with the left
        // or middle button. (panOnDrag button codes: 0 = left, 1 = middle.)
        selectionOnDrag={marquee}
        panOnDrag={marquee ? [1] : [0, 1]}
        selectionMode={SelectionMode.Partial}
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
      {drawing && <ArcDrawLayer />}
      {placing && <PlacingLayer kind={tool === "place" ? "place" : "transition"} />}
      <AlignmentGuideLayer guides={dragGuides} />
    </div>
  );
}

/** Resolve a dragged node's center: align to siblings on a lone drag, otherwise just grid-snap. */
function dragCenter(net: PetriNet, id: string, pos: Vec2, snap: boolean, single: boolean): Vec2 {
  if (single) return AlignmentGuides.resolve(pos, NetOps.nodeCenters(net, id), snap).position;
  return snap ? GridSnap.snap(pos) : pos;
}

/** Strip React Flow's selection flag from every element, keeping array identity if none were set. */
function clearSelected<T extends { selected?: boolean }>(items: T[]): T[] {
  if (!items.some((i) => i.selected)) return items;
  return items.map((i) => (i.selected ? { ...i, selected: false } : i));
}

/** Mark exactly the elements whose id is in `selected` as selected when re-deriving from the domain. */
function withSelection<T extends { id: string; selected?: boolean }>(
  next: T[],
  selected: Set<string>,
): T[] {
  return next.map((n) => {
    const want = selected.has(n.id);
    return (n.selected ?? false) === want ? n : { ...n, selected: want };
  });
}

/**
 * Apply the analytics glow to the lit nodes and strip it from the rest. `style` is the highlight's
 * alone (the projection never sets it), so it can be set and cleared wholesale; places round the
 * ring to a circle to match their shape, transitions leave it square.
 */
function withHighlight(nodes: PetriFlowNode[], lit: Set<string>): PetriFlowNode[] {
  return nodes.map((n) => {
    const on = lit.has(n.id);
    if (!on && !n.style) return n;
    const style = on
      ? { ...HIGHLIGHT_STYLE, ...(n.type === "place" ? { borderRadius: 9999 } : {}) }
      : undefined;
    return { ...n, style };
  });
}

/** Translate a stored point by (live − domain) of its node center. */
function shift(point: Vec2, live: Vec2, domain: Vec2): Vec2 {
  return { x: point.x + (live.x - domain.x), y: point.y + (live.y - domain.y) };
}

function center(net: PetriNet, id: string): Vec2 {
  const node = net.places.find((p) => p.id === id) ?? net.transitions.find((t) => t.id === id);
  return node?.position ?? { x: 0, y: 0 };
}
