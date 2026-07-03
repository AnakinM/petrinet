import { type JSX, useEffect, useState } from "react";
import { useNetStore } from "@/store/netStore";
import { PropertiesPanel } from "@/ui/PropertiesPanel";

/**
 * Bottom sheet holding the contextual editor, reusing the desktop {@link PropertiesPanel} verbatim
 * (Properties in Build, History in Simulate). In Build it auto-opens when something is selected and
 * unmounts when nothing is (so the canvas keeps its full height); in Simulate it is a collapsed
 * "History" pull-up. Tapping the header toggles it. Rendered above the tool dock in the shell's
 * bottom stack.
 */
export function MobilePropertiesSheet(): JSX.Element | null {
  const simulating = useNetStore((s) => s.mode === "simulate");
  const count = useNetStore((s) => s.selection.nodes.length + s.selection.edges.length);
  const [expanded, setExpanded] = useState(false);

  // Mirror the selection in Build (open on select, collapse on deselect); collapse on entering
  // Simulate so History starts as a pull-up rather than covering the canvas.
  useEffect(() => {
    setExpanded(simulating ? false : count > 0);
  }, [simulating, count]);

  // Build with nothing selected: no sheet at all.
  if (!simulating && count === 0) return null;

  const title = simulating ? "History" : count > 1 ? `${count} selected` : "Properties";

  return (
    <div className="pointer-events-auto border-slate-300 border-t-[3px] bg-white shadow-[0_-6px_10px_-6px_rgba(15,23,42,0.2)]">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full touch-manipulation flex-col items-center gap-1 px-4 pt-1.5 pb-1.5"
      >
        <span className="h-1 w-10 rounded-full bg-slate-300" />
        {!expanded && (
          <span className="font-medium text-slate-500 text-xs">{title} · tap to open</span>
        )}
      </button>
      {expanded && (
        <div className="max-h-[45dvh] overflow-auto overscroll-contain border-slate-200 border-t">
          <PropertiesPanel />
        </div>
      )}
    </div>
  );
}
