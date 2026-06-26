import type { JSX, ReactNode } from "react";
import { useAnalyticsStore } from "@/store/analyticsStore";

/** Cap on any analytics list (invariants, deadlocks, dead transitions); the overflow collapses to a note. */
export const DISPLAY_CAP = 50;

/** "Showing N of M" footer when a list is clipped to {@link DISPLAY_CAP}; renders nothing when it fits. */
export function Overflow({ total }: { total: number }): JSX.Element | null {
  if (total <= DISPLAY_CAP) return null;
  return (
    <p className="text-slate-400 text-xs">
      Showing {DISPLAY_CAP} of {total}.
    </p>
  );
}

/** A titled panel section with the shared uppercase heading. */
export function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The single click-to-spotlight affordance shared by every analytics tab: a button that lights
 * `ids` on the canvas (and toggles the spotlight off when they are already lit), amber-filled while
 * active. With no ids to spotlight it renders a non-interactive element, so an empty witness (e.g. a
 * deadlock at the all-zero marking) never looks clickable. `lit` is the live highlight joined with
 * commas — the parent reads it once and threads it down so each chip can tell if it is the lit one.
 */
export function HighlightChip({
  ids,
  lit,
  size = "row",
  children,
}: {
  ids: string[];
  lit: string;
  size?: "row" | "chip";
  children: ReactNode;
}): JSX.Element {
  const shape =
    size === "chip"
      ? "rounded border px-1.5 py-0.5 text-xs"
      : "rounded border px-2 py-1 text-left text-sm";
  if (ids.length === 0) {
    return <div className={`${shape} border-slate-200 bg-slate-50 text-slate-700`}>{children}</div>;
  }
  const active = ids.join(",") === lit;
  return (
    <button
      type="button"
      onClick={() => useAnalyticsStore.getState().highlightNodes(ids)}
      aria-pressed={active}
      className={`${shape} transition-colors ${
        active
          ? "border-amber-400 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-amber-300 hover:bg-amber-50"
      }`}
    >
      {children}
    </button>
  );
}
