import { useReactFlow, ViewportPortal } from "@xyflow/react";
import {
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState,
} from "react";
import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Vec2 } from "@/domain/types";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

const DIAMETER = NodeGeometry.PLACE_DIAMETER;
const BAR_WIDTH = NodeGeometry.TRANSITION_BAR_WIDTH;
const BAR_HEIGHT = NodeGeometry.TRANSITION_BAR_HEIGHT;

/**
 * The placing layer, mounted only while a Place/Transition Palette tool is active. Like
 * {@link ArcDrawLayer} it lays a screen-space capture overlay over the canvas — which also makes the
 * nodes' arc-start handles inert, so placing and arc-draw stay exclusive. A semi-transparent ghost
 * follows the cursor through a {@link ViewportPortal} (flow-space, so it pans/zooms), a click drops
 * that kind of node where the ghost sits (the tool stays active to place several), and Esc or
 * right-click returns to Idle. A freshly placed node is not selected.
 */
export function PlacingLayer({ kind }: { kind: "place" | "transition" }): JSX.Element {
  const { screenToFlowPosition } = useReactFlow();
  const [cursor, setCursor] = useState<Vec2 | null>(null);

  // Esc exits the tool; the listener lives only while this layer is mounted (i.e. while placing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") useBuildStore.getState().setTool("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flowAt = (e: { clientX: number; clientY: number }): Vec2 =>
    screenToFlowPosition({ x: e.clientX, y: e.clientY });

  const onPointerMove = (e: ReactPointerEvent): void => setCursor(flowAt(e));

  const onClick = (e: ReactMouseEvent): void => {
    e.stopPropagation();
    const at = flowAt(e);
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
