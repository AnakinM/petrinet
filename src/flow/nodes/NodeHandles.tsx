import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, JSX } from "react";
import { useNetStore } from "@/store/netStore";

// React Flow resolves each edge endpoint from a handle on the connected node, so every Petri
// node carries both a source and a target handle (a place or transition can be either end of
// an arc). The arc path is drawn from the domain polyline, not these handles, so their exact
// position is cosmetic. In Build mode they become small grab targets on the left/right border
// for drawing connections; otherwise they collapse to hidden points.
const CONNECT: CSSProperties = {
  width: 9,
  height: 9,
  background: "#cbd5e1",
  border: "1.5px solid #475569",
};
const HIDDEN: CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: "none",
  background: "transparent",
};

/** Source + target handles; grab targets for connecting in Build mode, hidden otherwise. */
export function NodeHandles(): JSX.Element {
  const editable = useNetStore((s) => s.mode === "build");
  const style = editable ? CONNECT : HIDDEN;
  return (
    <>
      <Handle type="target" position={Position.Left} style={style} isConnectable={editable} />
      <Handle type="source" position={Position.Right} style={style} isConnectable={editable} />
    </>
  );
}
