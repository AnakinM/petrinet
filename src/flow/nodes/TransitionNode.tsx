import type { NodeProps } from "@xyflow/react";
import { type JSX, useState } from "react";
import { NodeGeometry } from "@/domain/nodeGeometry";
import { NodeHandles } from "@/flow/nodes/NodeHandles";
import type { TransitionFlowNode } from "@/flow/projection";
import { useNetStore } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";

// Square node box; the bar is centered inside it so any rotation stays bounded. The bar's
// `.npn` geometry (15 wide x 40 tall) puts stored magnetic arc endpoints on the rendered border.
const BOX = NodeGeometry.TRANSITION_BOX;
const BAR_WIDTH = NodeGeometry.TRANSITION_BAR_WIDTH;
const BAR_HEIGHT = NodeGeometry.TRANSITION_BAR_HEIGHT;

const BASE_BAR = "shadow-sm transition-all duration-150";

/** A transition: a thin filled bar, rotatable via `gui.rotation`; in Simulate it glows when
 *  enabled and fires on click, flashing briefly as tokens move. */
export function TransitionNode({ data }: NodeProps<TransitionFlowNode>): JSX.Element {
  const { transition } = data;
  const rotation = transition.gui?.rotation ?? 0;
  const offset = transition.labelPosition ?? { x: 0, y: BOX / 2 + 10 };

  const simulating = useNetStore((s) => s.mode === "simulate");
  const enabled = useSimStore((s) => s.enabled.has(transition.id));
  const [flash, setFlash] = useState(false);
  const fireable = simulating && enabled;

  const fire = (): void => {
    if (!fireable) return;
    useSimStore.getState().fire(transition.id);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
  };

  return (
    <div className="relative" style={{ width: BOX, height: BOX }}>
      <NodeHandles />
      <div
        className="absolute top-1/2 left-1/2"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        {/* A real <button> (Simulate only, where nodes aren't draggable) gives free Enter/Space
            activation; the resting bar is a plain div so Build drag/select is unaffected. */}
        {fireable ? (
          <button
            type="button"
            onClick={fire}
            aria-label={`Fire ${transition.name}`}
            // pointer-events-auto re-enables clicks: React Flow sets the node wrapper to
            // pointer-events:none while it's locked (not draggable/selectable in Simulate).
            className={`pointer-events-auto ${barClass(true, flash)}`}
            style={{ width: BAR_WIDTH, height: BAR_HEIGHT }}
          />
        ) : (
          <div
            className={barClass(false, flash)}
            style={{ width: BAR_WIDTH, height: BAR_HEIGHT }}
          />
        )}
      </div>
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 whitespace-nowrap text-slate-700 text-xs"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
      >
        {transition.name}
      </span>
    </div>
  );
}

/** Bar styling: flashing (just fired) > enabled glow > resting slate. */
function barClass(fireable: boolean, flash: boolean): string {
  if (flash) return `${BASE_BAR} bg-emerald-300 shadow-[0_0_14px_4px_rgba(16,185,129,0.9)]`;
  if (fireable)
    return `${BASE_BAR} cursor-pointer bg-emerald-600 ring-2 ring-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,0.7)]`;
  return `${BASE_BAR} bg-slate-700`;
}
