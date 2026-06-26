import { useReactFlow, ViewportPortal } from "@xyflow/react";
import {
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";
import { type Alignment, AlignmentGuides, type Guide } from "@/domain/alignment";
import { NetOps } from "@/domain/netOps";
import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Vec2 } from "@/domain/types";
import { AlignmentGuideLayer } from "@/flow/AlignmentGuideLayer";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

const DIAMETER = NodeGeometry.PLACE_DIAMETER;
const BAR_WIDTH = NodeGeometry.TRANSITION_BAR_WIDTH;
const BAR_HEIGHT = NodeGeometry.TRANSITION_BAR_HEIGHT;

/**
 * The placing layer, mounted only while a Place/Transition Palette tool is active. Like
 * {@link ArcDrawLayer} it lays a screen-space capture overlay over the canvas — which also makes the
 * nodes' arc-start handles inert, so placing and arc-draw stay exclusive. A semi-transparent ghost
 * follows the cursor through a {@link ViewportPortal} (flow-space, so it pans/zooms), snapped to the
 * grid and pulled to align with the other nodes' centers (rose guides show the alignment). A click
 * drops that kind of node where the ghost sits (the tool stays active to place several), Esc or
 * right-click returns to Idle, and a freshly placed node is not selected.
 */
export function PlacingLayer({ kind }: { kind: "place" | "transition" }): JSX.Element {
  const { screenToFlowPosition } = useReactFlow();
  const snap = useBuildStore((s) => s.snap);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  // Esc exits the tool; the listener lives only while this layer is mounted (i.e. while placing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") useBuildStore.getState().setTool("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Where the node would land: the cursor snapped/aligned against the other node centers.
  const resolveAt = (e: { clientX: number; clientY: number }): Alignment => {
    const raw = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    return AlignmentGuides.resolve(raw, NetOps.nodeCenters(useNetStore.getState().net), snap);
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    const r = resolveAt(e);
    setCursor(r.position);
    setGuides(r.guides);
  };

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const at = resolveAt(e).position;
    const store = useNetStore.getState();
    if (kind === "place") store.addPlace(at);
    else store.addTransition(at);
  };

  const onContextMenu = (e: ReactMouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    useBuildStore.getState().setTool("idle");
  };

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-driven placing surface, not a semantic control. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: placement clicks on the canvas have no keyboard analogue; Esc exits via the window listener above. */}
      <div
        className="absolute inset-0 cursor-crosshair"
        style={{ zIndex: 1100 }}
        onPointerMove={onPointerMove}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
      <AlignmentGuideLayer guides={guides} />
      {cursor && (
        <ViewportPortal>
          <div
            style={{
              position: "absolute",
              left: cursor.x,
              top: cursor.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              opacity: 0.5,
            }}
          >
            {kind === "place" ? (
              <div
                className="rounded-full border-2 border-slate-700 bg-white"
                style={{ width: DIAMETER, height: DIAMETER }}
              />
            ) : (
              <div className="bg-slate-700" style={{ width: BAR_WIDTH, height: BAR_HEIGHT }} />
            )}
          </div>
        </ViewportPortal>
      )}
    </>
  );
}
