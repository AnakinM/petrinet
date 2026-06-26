import { useReactFlow, ViewportPortal } from "@xyflow/react";
import {
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
} from "react";
import { NetOps } from "@/domain/netOps";
import { NodeGeometry } from "@/domain/nodeGeometry";
import type { PetriNet, Vec2 } from "@/domain/types";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { type ArcDraft, useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

const RUBBER_COLOR = "#6366f1"; // indigo-500
const VALID_COLOR = "#10b981"; // emerald-500
const INVALID_COLOR = "#ef4444"; // red-500
// Slightly forgiving hit radius so a click near a node border still finishes on it.
const HIT_PAD = 6;

/**
 * The click-to-draw arc layer, mounted only while an arc is in progress (see {@link ArcDraft}).
 *
 * It renders a screen-space capture overlay that owns the draw state machine — move tracks the
 * cursor, a click on empty canvas drops a bend, a click on a valid target node finishes the arc
 * (an invalid target or the source itself is ignored and the draw continues), and Esc or
 * right-click cancels. The rubber-band line and the valid/invalid hover ring are drawn in
 * flow-space through a {@link ViewportPortal} so they pan and zoom with the canvas.
 */
export function ArcDrawLayer(): JSX.Element | null {
  const draft = useBuildStore((s) => s.draft);
  const net = useNetStore((s) => s.net);
  const { screenToFlowPosition } = useReactFlow();

  // Esc cancels; the listener lives only while this layer is mounted (i.e. while drawing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") useBuildStore.getState().cancelArc();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!draft) return null;

  const flowAt = (e: { clientX: number; clientY: number }): Vec2 =>
    screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const onPointerMove = (e: ReactPointerEvent): void => {
    const at = flowAt(e);
    useBuildStore.getState().moveDraft(at, NetOps.nodeAt(net, at, HIT_PAD));
  };

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const at = flowAt(e);
    const current = useNetStore.getState().net;
    const hit = NetOps.nodeAt(current, at, HIT_PAD);
    if (hit) {
      // Finish only on a valid target; the source itself or an invalid pair is ignored.
      if (hit !== draft.source && NetOps.canConnect(current, draft.source, hit)) {
        useNetStore.getState().connect(draft.source, hit, draft.bends);
        useBuildStore.getState().cancelArc();
      }
      return;
    }
    useBuildStore.getState().addBend(at);
  };

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    useBuildStore.getState().cancelArc();
  };

  // Source endpoint clips to the border toward the first bend (or the live cursor when straight).
  const srcBorder = NetOps.borderPoint(net, draft.source, draft.bends[0] ?? draft.cursor);
  const rubberPath = ArcGeometry.roundedPath([srcBorder, ...draft.bends, draft.cursor]);
  const ring = ringFor(net, draft);
  const cursorClass = ring && !ring.valid ? "cursor-not-allowed" : "cursor-crosshair";

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-driven canvas draw surface, not a semantic control. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: bend/finish clicks on the canvas have no keyboard analogue; Esc cancels via the window listener above. */}
      <div
        className={`absolute inset-0 ${cursorClass}`}
        style={{ zIndex: 1100 }}
        onPointerMove={onPointerMove}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
      <ViewportPortal>
        <svg
          aria-hidden="true"
          style={{ position: "absolute", overflow: "visible", pointerEvents: "none", zIndex: 1000 }}
        >
          <path
            d={rubberPath}
            fill="none"
            stroke={RUBBER_COLOR}
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
        </svg>
        {ring && <Ring info={ring} />}
      </ViewportPortal>
    </>
  );
}

/** Geometry + validity of the node the cursor is over during a draw (null when none/the source). */
interface RingInfo {
  center: Vec2;
  kind: "place" | "transition";
  rotation: number;
  valid: boolean;
}

function ringFor(net: PetriNet, draft: ArcDraft): RingInfo | null {
  const id = draft.hoverTarget;
  if (!id || id === draft.source) return null;
  const valid = NetOps.canConnect(net, draft.source, id);
  const place = net.places.find((p) => p.id === id);
  if (place) return { center: place.position, kind: "place", rotation: 0, valid };
  const transition = net.transitions.find((t) => t.id === id);
  if (transition) {
    return {
      center: transition.position,
      kind: "transition",
      rotation: transition.gui?.rotation ?? 0,
      valid,
    };
  }
  return null;
}

/** Emerald (valid) / red (invalid) ring around the hovered target node, drawn in flow-space. */
function Ring({ info }: { info: RingInfo }): JSX.Element {
  const color = info.valid ? VALID_COLOR : INVALID_COLOR;
  const isPlace = info.kind === "place";
  const width = isPlace ? NodeGeometry.PLACE_DIAMETER + 12 : NodeGeometry.TRANSITION_BAR_WIDTH + 14;
  const height = isPlace
    ? NodeGeometry.PLACE_DIAMETER + 12
    : NodeGeometry.TRANSITION_BAR_HEIGHT + 12;
  return (
    <div
      style={{
        position: "absolute",
        left: info.center.x,
        top: info.center.y,
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${info.rotation}deg)`,
        border: `2px solid ${color}`,
        borderRadius: isPlace ? "9999px" : "4px",
        boxShadow: `0 0 8px ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}
