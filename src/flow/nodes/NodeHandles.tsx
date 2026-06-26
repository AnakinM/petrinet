import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, JSX } from "react";

// React Flow resolves each edge endpoint from a handle on the connected node, so every Petri
// node carries both a source and a target handle (a place or transition can be either end of
// an arc). The arc path is drawn from the domain polyline, not these handles, so their exact
// position is cosmetic and they stay collapsed to hidden points. Connecting is no longer done
// by dragging these handles — the click-to-draw layer (ArcStartHandles + ArcDrawLayer) owns it.
const HIDDEN: CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
};

/** Hidden source + target anchors so React Flow can resolve each arc's endpoints. */
export function NodeHandles(): JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Left} style={HIDDEN} isConnectable={false} />
      <Handle type="source" position={Position.Right} style={HIDDEN} isConnectable={false} />
    </>
  );
}
