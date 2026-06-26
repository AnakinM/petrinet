import { useReactFlow } from "@xyflow/react";
import type { JSX, PointerEvent as ReactPointerEvent } from "react";
import { useBuildStore } from "@/store/buildStore";

// Small indigo circle straddling the node's left/right border. Hidden by default, it fades in
// while the node is hovered (group-hover on the node wrapper) and stays while it is selected.
const DOT =
  "nodrag nopan pointer-events-auto absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border border-white bg-indigo-500 shadow transition-opacity";

/**
 * The arc-start affordance: two circles on a node's left/right border. Pressing one begins a
 * click-to-draw arc from this node (which border is just the launch point — the real endpoint
 * is computed by border geometry). Body clicks still select the node. Build mode only.
 */
export function ArcStartHandles({
  nodeId,
  selected,
}: {
  nodeId: string;
  selected: boolean;
}): JSX.Element | null {
  const { screenToFlowPosition } = useReactFlow();
  // Drawing an arc is an Idle-mode action; a placing/select tool hides the handles entirely.
  const idle = useBuildStore((s) => s.tool === "idle");
  if (!idle) return null;
  const visibility = selected ? "opacity-100" : "opacity-0 group-hover:opacity-100";

  const start = (e: ReactPointerEvent): void => {
    // Stop the node from selecting/dragging; hand off to the draw layer instead.
    e.stopPropagation();
    const at = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    useBuildStore.getState().startArc(nodeId, at);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Draw an arc from this node"
        onPointerDown={start}
        className={`${DOT} ${visibility} left-0 -translate-x-1/2`}
      />
      <button
        type="button"
        aria-label="Draw an arc from this node"
        onPointerDown={start}
        className={`${DOT} ${visibility} right-0 translate-x-1/2`}
      />
    </>
  );
}
