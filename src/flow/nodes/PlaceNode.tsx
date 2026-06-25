import type { NodeProps } from "@xyflow/react";
import type { JSX } from "react";
import { PlaceTokens } from "@/flow/nodes/tokens";
import type { PlaceFlowNode } from "@/flow/projection";

/** Diameter of the place circle, in flow units. */
const DIAMETER = 44;

/** A place: a circle whose tokens render as dots (few) or a numeral (many). */
export function PlaceNode({ data }: NodeProps<PlaceFlowNode>): JSX.Element {
  const { place } = data;
  const display = PlaceTokens.display(place.tokens);
  const offset = place.labelPosition ?? { x: 0, y: DIAMETER / 2 + 10 };

  return (
    <div className="relative" style={{ width: DIAMETER, height: DIAMETER }}>
      <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-slate-700 bg-white shadow-sm">
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
      </div>
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 whitespace-nowrap text-slate-700 text-xs"
        style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
      >
        {place.name}
      </span>
    </div>
  );
}
