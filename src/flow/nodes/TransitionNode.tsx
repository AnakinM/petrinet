import type { NodeProps } from "@xyflow/react";
import type { JSX } from "react";
import { NodeGeometry } from "@/domain/nodeGeometry";
import { NodeHandles } from "@/flow/nodes/NodeHandles";
import type { TransitionFlowNode } from "@/flow/projection";

// Square node box; the bar is centered inside it so any rotation stays bounded. The bar's
// `.npn` geometry (15 wide x 40 tall) puts stored magnetic arc endpoints on the rendered border.
const BOX = NodeGeometry.TRANSITION_BOX;
const BAR_WIDTH = NodeGeometry.TRANSITION_BAR_WIDTH;
const BAR_HEIGHT = NodeGeometry.TRANSITION_BAR_HEIGHT;

/** A transition: a thin filled bar, rotatable via `gui.rotation` about its center. */
export function TransitionNode({ data }: NodeProps<TransitionFlowNode>): JSX.Element {
  const { transition } = data;
  const rotation = transition.gui?.rotation ?? 0;
  const offset = transition.labelPosition ?? { x: 0, y: BOX / 2 + 10 };

  return (
    <div className="relative" style={{ width: BOX, height: BOX }}>
      <NodeHandles />
      <div
        className="absolute top-1/2 left-1/2"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        <div className="bg-slate-700 shadow-sm" style={{ width: BAR_WIDTH, height: BAR_HEIGHT }} />
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
