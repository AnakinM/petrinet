import type { JSX, ReactNode } from "react";
import type { Verdict } from "@/domain/analysis/types";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { CheckIcon, CrossIcon, QuestionIcon } from "@/ui/icons";

/** Cap on any analytics list (invariants, deadlocks, dead transitions); the overflow collapses to a note. */
export const DISPLAY_CAP = 50;

const VERDICT_META: Record<
  Verdict,
  { label: string; tone: string; Icon: (p: { className?: string }) => JSX.Element }
> = {
  yes: { label: "Yes", tone: "bg-green-500", Icon: CheckIcon },
  no: { label: "No", tone: "bg-red-500", Icon: CrossIcon },
  indeterminate: { label: "Unknown", tone: "bg-amber-500", Icon: QuestionIcon },
};

/**
 * A small "?" help affordance. The explanation shows as a native tooltip on hover — matching the
 * app's other title-based hints (nodes, the resize grip) and never clipping inside the scrolling
 * panel — and is exposed to assistive tech via aria-label.
 */
export function HelpTip({ text }: { text: string }): JSX.Element {
  return (
    <span
      role="img"
      title={text}
      aria-label={`Help: ${text}`}
      className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help select-none items-center justify-center rounded-full border border-slate-300 font-normal text-[9px] text-slate-400 normal-case leading-none"
    >
      ?
    </span>
  );
}

/** A labelled status pill — coloured icon + word (Yes / No / Unknown) — for a property's verdict. */
export function StatusBadge({ verdict }: { verdict: Verdict }): JSX.Element {
  const { label, tone, Icon } = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-white text-xs ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/**
 * A property card in the competitor's Status + Reasons shape: the title and a labelled status pill on
 * one header row, then the explanation as a lead line plus bulleted reasons. `children` carries rich
 * extras (e.g. click-to-spotlight chips) below the reasons.
 */
export function StatusCard({
  title,
  verdict,
  detail,
  items,
  help,
  children,
}: {
  title: string;
  verdict: Verdict;
  detail?: string;
  items?: string[];
  help?: string;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5 rounded border border-slate-200 p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 font-medium text-slate-700 text-sm">
          {title}
          {help && <HelpTip text={help} />}
        </span>
        <StatusBadge verdict={verdict} />
      </div>
      {detail && <p className="text-slate-500 text-xs">{detail}</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-slate-500 text-xs">
          {items.map((item) => (
            <li key={item} className="flex gap-1.5">
              <span aria-hidden="true" className="select-none text-slate-300">
                •
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

/** "Showing N of M" footer when a list is clipped to {@link DISPLAY_CAP}; renders nothing when it fits. */
export function Overflow({ total }: { total: number }): JSX.Element | null {
  if (total <= DISPLAY_CAP) return null;
  return (
    <p className="text-slate-400 text-xs">
      Showing {DISPLAY_CAP} of {total}.
    </p>
  );
}

/** A titled panel section with the shared uppercase heading and an optional "?" help tooltip. */
export function Section({
  title,
  help,
  children,
}: {
  title: string;
  help?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1 font-semibold text-slate-500 text-xs uppercase tracking-wide">
        {title}
        {help && <HelpTip text={help} />}
      </h3>
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
