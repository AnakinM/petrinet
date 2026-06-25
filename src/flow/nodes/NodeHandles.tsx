import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, JSX } from "react";

// React Flow resolves each edge endpoint from a handle on the connected node, so every
// Petri node needs both a source and a target handle (a place or transition can be either
// end of an arc). The arc path is drawn from the domain polyline, not these handles, so
// they are collapsed to a hidden point at the node center and out of the way.
const HIDDEN: CSSProperties = {
  left: "50%",
  top: "50%",
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  transform: "translate(-50%, -50%)",
  border: "none",
  background: "transparent",
};

/** Invisible, centered source + target handles shared by every Petri node. */
export function NodeHandles(): JSX.Element {
  return (
    <>
      <Handle type="target" position={Position.Left} style={HIDDEN} isConnectable={false} />
      <Handle type="source" position={Position.Right} style={HIDDEN} isConnectable={false} />
    </>
  );
}
