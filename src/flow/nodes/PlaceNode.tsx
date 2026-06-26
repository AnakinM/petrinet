import type { NodeProps } from "@xyflow/react";
import type { JSX, MouseEvent } from "react";
import { NodeGeometry } from "@/domain/nodeGeometry";
import { NodeHandles } from "@/flow/nodes/NodeHandles";
import { PlaceTokens } from "@/flow/nodes/tokens";
import type { PlaceFlowNode } from "@/flow/projection";
import { useNetStore } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";

// Diameter of the place circle (radius 20), fixed by the `.npn` geometry so stored
// magnetic arc endpoints land exactly on the rendered border.
const DIAMETER = NodeGeometry.PLACE_DIAMETER;

const CIRCLE =
  "flex h-full w-full items-center justify-center rounded-full border-2 border-slate-700 bg-white shadow-sm";

/** A place: a circle whose tokens render as dots (few) or a numeral (many). In Simulate it
 *  is a token source — click adds a token, shift-click removes one. */
export function PlaceNode({ data }: NodeProps<PlaceFlowNode>): JSX.Element {
  const { place } = data;
  const simulating = useNetStore((s) => s.mode === "simulate");
  // In Simulate the live working marking overrides M0; in Build no marking is held for
  // this id, so it falls back to the persisted (M0) token count.
  const liveTokens = useSimStore((s) => s.marking[place.id]);
  const display = PlaceTokens.display(liveTokens ?? place.tokens);
  const offset = place.labelPosition ?? { x: 0, y: DIAMETER / 2 + 10 };

  const spawn = (e: MouseEvent): void => {
    useSimStore.getState().spawnToken(place.id, e.shiftKey ? -1 : 1);
  };

  const tokens = (
    <>
      {display.kind === "dots" && (
        <div className="grid grid-cols-2 place-items-center gap-1">
          {Array.from({ length: display.count }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: dots are positionless and identical
              key={i}
              className="h-[7px] w-[7px] rounded-full bg-slate-900"
            />
          ))}
        </div>
      )}
      {display.kind === "number" && (
        <span className="font-semibold text-slate-900 text-sm">{display.value}</span>
      )}
    </>
  );

  return (
    <div className="relative" style={{ width: DIAMETER, height: DIAMETER }}>
      <NodeHandles />
      {simulating ? (
        <button
          type="button"
          onClick={spawn}
          aria-label={`${place.name}: add a token (shift-click to remove)`}
          title="Click to add a token · shift-click to remove"
          // pointer-events-auto re-enables clicks: React Flow locks the node wrapper to
          // pointer-events:none in Simulate (not draggable/selectable).
          className={`pointer-events-auto cursor-pointer hover:ring-2 hover:ring-slate-300 ${CIRCLE}`}
        >
          {tokens}
        </button>
      ) : (
        <div className={CIRCLE}>{tokens}</div>
      )}
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 whitespace-nowrap text-slate-700 text-xs"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
      >
        {place.name}
      </span>
    </div>
  );
}
