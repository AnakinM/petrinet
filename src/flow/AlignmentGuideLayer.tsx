import { ViewportPortal } from "@xyflow/react";
import type { CSSProperties, JSX } from "react";
import type { Guide } from "@/domain/alignment";

// A theme token, set through `style`: `var()` in a bare SVG attribute does not resolve everywhere.
const GUIDE_STYLE: CSSProperties = { stroke: "var(--color-canvas-guide)" };

/**
 * Renders the rose alignment guides in flow-space (so they pan/zoom with the canvas). `non-scaling`
 * keeps the lines a crisp 1px at any zoom. Inert (returns null) when there are no guides; the
 * placing and drag layers own the guide state and pass it in.
 */
export function AlignmentGuideLayer({ guides }: { guides: Guide[] }): JSX.Element | null {
  if (guides.length === 0) return null;
  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        style={{ position: "absolute", overflow: "visible", pointerEvents: "none", zIndex: 4 }}
      >
        {guides.map((g) => {
          const [x1, y1, x2, y2] =
            g.orientation === "vertical" ? [g.at, g.from, g.at, g.to] : [g.from, g.at, g.to, g.at];
          return (
            <line
              key={g.orientation}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              style={GUIDE_STYLE}
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </ViewportPortal>
  );
}
