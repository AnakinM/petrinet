import type { JSX, ReactNode } from "react";
import { useBuildStore } from "@/store/buildStore";

/**
 * Mutually-exclusive placing tools. Clicking a tool activates it (a ghost then follows the cursor
 * and clicks drop that kind of node); clicking the active tool again returns to Idle. Build mode
 * only — the panel above Properties.
 */
export function Palette(): JSX.Element {
  const tool = useBuildStore((s) => s.tool);
  const toggleTool = useBuildStore((s) => s.toggleTool);

  return (
    <section className="flex flex-col gap-3 p-3">
      <h2 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Palette</h2>
      <ToolButton active={tool === "place"} onClick={() => toggleTool("place")}>
        <span className="h-5 w-5 rounded-full border-2 border-current" />
        Place
      </ToolButton>
      <ToolButton active={tool === "transition"} onClick={() => toggleTool("transition")}>
        <span className="h-5 w-[7px] bg-current" />
        Transition
      </ToolButton>
      <ToolButton active={tool === "select"} onClick={() => toggleTool("select")}>
        <span className="h-5 w-5 rounded-[2px] border border-current border-dashed" />
        Select
      </ToolButton>
    </section>
  );
}

/** A Palette tool toggle; the swatch inherits `currentColor` so it inverts when active. */
function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex items-center gap-2 rounded border border-slate-700 bg-slate-700 px-3 py-2 text-sm text-white shadow-sm"
          : "flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-slate-700 text-sm shadow-sm hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}
