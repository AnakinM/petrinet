import type { JSX, ReactNode } from "react";
import { useBuildStore } from "@/store/buildStore";
import { TOOLS } from "@/ui/buildTools";

/**
 * Mutually-exclusive placing tools. Clicking a tool activates it (a ghost then follows the cursor
 * and clicks drop that kind of node); clicking the active tool again returns to Idle. Build mode
 * only (the panel above Properties). Tools come from the shared {@link TOOLS} descriptor, so the
 * desktop palette and the mobile dock render the same set.
 */
export function Palette(): JSX.Element {
  const tool = useBuildStore((s) => s.tool);
  const toggleTool = useBuildStore((s) => s.toggleTool);

  return (
    <section className="flex flex-col gap-3 p-3">
      <h2 className="font-semibold text-fg-subtle text-sm uppercase tracking-wide">Palette</h2>
      {TOOLS.map((t) => (
        <ToolButton key={t.id} active={tool === t.id} onClick={() => toggleTool(t.id)}>
          {t.swatch}
          {t.label}
        </ToolButton>
      ))}
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
          ? "flex items-center gap-2 rounded border border-accent bg-accent px-3 py-2 text-sm text-on-accent shadow-sm"
          : "flex items-center gap-2 rounded border border-line-strong bg-surface-raised px-3 py-2 text-fg-soft text-sm shadow-sm hover:bg-surface-hover"
      }
    >
      {children}
    </button>
  );
}
