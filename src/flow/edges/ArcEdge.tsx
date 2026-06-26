import { BaseEdge, EdgeLabelRenderer, type EdgeProps, useReactFlow } from "@xyflow/react";
import {
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { type ArcEnd, NetOps } from "@/domain/netOps";
import type { Vec2 } from "@/domain/types";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { ARC_COLOR, type ArcFlowEdge } from "@/flow/projection";
import { useNetStore } from "@/store/netStore";

/** An in-progress handle drag: the active point index plus a live draft polyline. */
type Drag =
  | { kind: "waypoint"; index: number; points: Vec2[] }
  | { kind: "endpoint"; index: number; end: ArcEnd; points: Vec2[] };

/**
 * Custom arc edge: a straight-segment polyline drawn directly through the domain arc's
 * `points` (endpoints are stored already clipped to the node borders, so the passive render
 * needs no recomputation and never writes geometry back). When the arc is selected in Build
 * mode it grows interactive handles: drag an endpoint (magnetic ends re-clip to the node
 * border, free ends follow the cursor), drag an interior waypoint, click a faint segment
 * handle to insert a waypoint, or double-click a waypoint to remove it. Drags preview locally
 * and commit one history entry on release; insert and remove commit immediately.
 */
export function ArcEdge({
  id,
  data,
  markerEnd,
  selected,
}: EdgeProps<ArcFlowEdge>): JSX.Element | null {
  const editable = useNetStore((s) => s.mode === "build");
  const { screenToFlowPosition } = useReactFlow();
  const [drag, setDrag] = useState<Drag | null>(null);
  // Last waypoint press, for manual double-tap detection (native dblclick is unreliable
  // through the pointer-capture drag). A real drag clears it so only taps-in-place pair up.
  const lastTap = useRef<{ index: number; t: number }>({ index: -1, t: 0 });
  const pressPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // `data` is always supplied by FlowProjection.toEdges; this satisfies the optional edge type.
  if (!data) return null;

  const { arc } = data;
  const points = drag?.points ?? arc.points;
  const last = points.length - 1;
  const weightLabel = arc.multiplicity > 1 ? ArcGeometry.midpoint(points) : null;
  const showHandles = editable && selected === true;

  const toFlow = (e: ReactPointerEvent): Vec2 =>
    screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const begin = (e: ReactPointerEvent, init: Drag): void => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pressPos.current = { x: e.clientX, y: e.clientY };
    setDrag(init);
  };

  const move = (e: ReactPointerEvent): void => {
    if (!drag) return;
    e.stopPropagation();
    const cursor = toFlow(e);
    const pos =
      drag.kind === "endpoint"
        ? NetOps.endpointDrop(useNetStore.getState().net, id, drag.end, cursor)
        : cursor;
    setDrag({ ...drag, points: drag.points.map((p, i) => (i === drag.index ? pos : p)) });
  };

  const end = (e: ReactPointerEvent): void => {
    if (!drag) return;
    e.stopPropagation();
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Only an actual drag commits geometry. A tap-in-place writes nothing (so it can be the
    // first half of a double-tap-to-remove, and never perturbs `points` on a stray click).
    const moved = Math.hypot(e.clientX - pressPos.current.x, e.clientY - pressPos.current.y) > 4;
    if (moved) {
      const cursor = toFlow(e);
      const store = useNetStore.getState();
      if (drag.kind === "endpoint") store.moveEndpoint(id, drag.end, cursor);
      else store.moveWaypoint(id, drag.index, cursor);
      lastTap.current = { index: -1, t: 0 };
    }
    setDrag(null);
  };

  /** True on the second tap-in-place of waypoint `index` within the double-tap window. */
  const tapIsDouble = (index: number): boolean => {
    const now = Date.now();
    const isDouble = lastTap.current.index === index && now - lastTap.current.t < 350;
    lastTap.current = isDouble ? { index: -1, t: 0 } : { index, t: now };
    return isDouble;
  };

  return (
    <>
      <BaseEdge
        path={ArcGeometry.roundedPath(points)}
        markerEnd={markerEnd}
        style={{ stroke: ARC_COLOR, strokeWidth: 1.5 }}
      />
      <EdgeLabelRenderer>
        {weightLabel && (
          <div
            className="nodrag nopan pointer-events-none absolute rounded border border-slate-300 bg-white px-1 font-semibold text-[11px] text-slate-700 leading-tight shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${weightLabel.x}px, ${weightLabel.y}px)`,
            }}
          >
            {arc.multiplicity}
          </div>
        )}
        {showHandles &&
          points.map((p, i) => {
            const end0: ArcEnd | null = i === 0 ? "src" : i === last ? "dest" : null;
            return (
              <Dot
                // biome-ignore lint/suspicious/noArrayIndexKey: a point's index is its identity in the polyline; the handle is stateless
                key={`pt-${i}`}
                point={p}
                variant={end0 ? "endpoint" : "waypoint"}
                onPointerDown={(e) => {
                  // Double-tapping an interior waypoint removes it (endpoints are not removable).
                  if (!end0 && tapIsDouble(i)) {
                    e.stopPropagation();
                    useNetStore.getState().removeWaypoint(id, i);
                    return;
                  }
                  begin(
                    e,
                    end0
                      ? { kind: "endpoint", index: i, end: end0, points: [...points] }
                      : { kind: "waypoint", index: i, points: [...points] },
                  );
                }}
                onPointerMove={move}
                onPointerUp={end}
              />
            );
          })}
        {showHandles &&
          !drag &&
          points.slice(0, last).map((p, i) => {
            const mid: Vec2 = { x: (p.x + points[i + 1].x) / 2, y: (p.y + points[i + 1].y) / 2 };
            return (
              <Dot
                // biome-ignore lint/suspicious/noArrayIndexKey: segment index is its identity along the polyline; the handle is stateless
                key={`seg-${i}`}
                point={mid}
                variant="insert"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  useNetStore.getState().insertWaypoint(id, i + 1, mid);
                }}
              />
            );
          })}
      </EdgeLabelRenderer>
    </>
  );
}

const DOT_BASE = "nodrag nopan pointer-events-auto absolute rounded-full";
const HANDLE_Z = 1001;
const DOT_VARIANT: Record<"endpoint" | "waypoint" | "insert", string> = {
  endpoint:
    "h-[10px] w-[10px] cursor-grab border border-white bg-indigo-500 active:cursor-grabbing",
  waypoint:
    "h-[10px] w-[10px] cursor-grab border-2 border-indigo-500 bg-white active:cursor-grabbing",
  insert:
    "h-[9px] w-[9px] cursor-copy border border-indigo-400 bg-white opacity-40 hover:opacity-100",
};

/** A draggable/clickable edit handle positioned at a flow-space point. */
function Dot({
  point,
  variant,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}: {
  point: Vec2;
  variant: "endpoint" | "waypoint" | "insert";
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove?: (e: ReactPointerEvent) => void;
  onPointerUp?: (e: ReactPointerEvent) => void;
  onClick?: (e: ReactMouseEvent) => void;
}): JSX.Element {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-driven canvas edit handle, like a React Flow node — not a semantic control.
    // biome-ignore lint/a11y/useKeyWithClickEvents: dragging/clicking a waypoint on the canvas has no keyboard analogue.
    <div
      className={`${DOT_BASE} ${DOT_VARIANT[variant]}`}
      style={{
        transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
        // Sit above React Flow's nodes (and their connection handles, which a magnetic
        // endpoint lands on) so an endpoint on a node border stays grabbable. 1001 clears
        // RF's selected/dragged-node ceiling of 1000; the viewport transform contains it.
        zIndex: HANDLE_Z,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onClick}
    />
  );
}
