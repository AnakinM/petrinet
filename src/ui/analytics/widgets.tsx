import { type JSX, type PointerEvent, type ReactNode, useEffect, useRef } from "react";
import type { Verdict } from "@/domain/analysis/types";
import {
  NO_SPOTLIGHT,
  type Spotlight,
  spotlightKey,
  useAnalyticsStore,
} from "@/store/analyticsStore";
import { HelpTip } from "@/ui/analytics/HelpTip";
import type { HelpTopic } from "@/ui/analytics/helpTexts";
import { CheckIcon, CrossIcon, QuestionIcon } from "@/ui/icons";

/** Cap on any analysis list (invariants, deadlocks, dead transitions); the overflow collapses to a note. */
export const DISPLAY_CAP = 50;

/** The kind of net element a chip names, shown as a small mark in front of its name. */
export type ElementKind = "place" | "transition";

/** The mark of a card whose answer needs the full analysis, shown until that has run. */
export const PENDING_LABEL = "Needs the full analysis";

const VERDICT_META: Record<
  Verdict,
  { label: string; tone: string; Icon: (p: { className?: string }) => JSX.Element }
> = {
  yes: { label: "Yes", tone: "bg-green-600", Icon: CheckIcon },
  no: { label: "No", tone: "bg-red-600", Icon: CrossIcon },
  indeterminate: { label: "Unknown", tone: "bg-amber-500", Icon: QuestionIcon },
};

/** A labelled status pill for a verdict: coloured icon + word (Yes / No / Unknown). */
export function VerdictBadge({ verdict }: { verdict: Verdict }): JSX.Element {
  const { label, tone, Icon } = VERDICT_META[verdict];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-sm text-white ${tone}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

/** The grey mark of a card whose answer needs the full analysis, which has not run for this net. */
export function PendingBadge(): JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 font-medium text-slate-600 text-sm">
      {PENDING_LABEL}
    </span>
  );
}

/** A quiet mark for a card that counts something ("3", "Acyclic", "14 markings"). */
export function CountMark({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 text-sm">
      {children}
    </span>
  );
}

/**
 * The one card of the Analysis panel: a dark title of normal size with its help icon, an optional
 * mark on the right (a verdict, a count, "Acyclic" ...), and a body in normal dark text.
 */
export function Card({
  title,
  help,
  mark,
  children,
}: {
  title: string;
  help?: HelpTopic;
  mark?: ReactNode;
  children?: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h3 className="flex items-center gap-1.5 font-medium text-base text-slate-900">
          {title}
          {help && <HelpTip topic={help} />}
        </h3>
        {mark}
      </div>
      {children !== undefined && (
        <div className="flex flex-col gap-2 text-slate-700 text-sm">{children}</div>
      )}
    </section>
  );
}

/**
 * A {@link Card} for one verdict: the verdict pill, a lead sentence and optional bullets. `pending`
 * marks a result that needs the full analysis before it can say anything, so the card shows
 * {@link PendingBadge} instead of an amber "Unknown", which stays for results the analysis could
 * not settle.
 */
export function VerdictCard({
  title,
  help,
  verdict,
  pending = false,
  detail,
  items,
  children,
}: {
  title: string;
  help?: HelpTopic;
  verdict: Verdict;
  pending?: boolean;
  detail?: string;
  items?: string[];
  children?: ReactNode;
}): JSX.Element {
  const lead = !pending && detail ? <p>{detail}</p> : null;
  const bullets = !pending && items && items.length > 0 ? <Bullets items={items} /> : null;
  // A pending card with no part of its own has no body at all, so no empty gap under its title.
  const body =
    lead || bullets || children ? (
      <>
        {lead}
        {bullets}
        {children}
      </>
    ) : undefined;
  return (
    <Card
      title={title}
      help={help}
      mark={pending ? <PendingBadge /> : <VerdictBadge verdict={verdict} />}
    >
      {body}
    </Card>
  );
}

export function Bullets({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item} className="flex gap-1.5">
          <span aria-hidden="true" className="select-none text-slate-400">
            •
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A heading inside a card for one of its parts, such as "Place bounds" in the Bounded card. */
export function SubHeading({ title, help }: { title: string; help?: HelpTopic }): JSX.Element {
  return (
    <h4 className="flex items-center gap-1.5 font-medium text-slate-900 text-sm">
      {title}
      {help && <HelpTip topic={help} />}
    </h4>
  );
}

/** A quieter line of text in a card: a caveat or a summary. */
export function Note({ children }: { children: ReactNode }): JSX.Element {
  return <p className="text-slate-500 text-sm">{children}</p>;
}

/** "Showing N of M" footer when a list is clipped to {@link DISPLAY_CAP}; renders nothing when it fits. */
export function Overflow({ total }: { total: number }): JSX.Element | null {
  if (total <= DISPLAY_CAP) return null;
  return (
    <Note>
      Showing {DISPLAY_CAP} of {total}.
    </Note>
  );
}

/** A small mark that says what a name stands for: a circle for a place, a bar for a transition. */
export function ElementMark({ kind }: { kind: ElementKind }): JSX.Element {
  if (kind === "place") {
    return (
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-current opacity-70"
      />
    );
  }
  return (
    <span aria-hidden="true" className="inline-block h-3 w-1.5 shrink-0 bg-current opacity-70" />
  );
}

/** A wrapping row of chips. */
export function ChipList({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex flex-wrap gap-1">{children}</div>;
}

/** The pointer handlers of a result that lights `target` on the canvas while the mouse rests on it. */
export interface HoverPreview {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}

/**
 * Light `target` while the mouse rests on the element that spreads these handlers, and clear it on
 * leave. A finger never previews: its tap goes straight to the click. If the element disappears
 * while hovered (a tab switch, a new analysis), the preview is cleared with it.
 */
export function useHoverPreview(target: Spotlight): HoverPreview {
  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) useAnalyticsStore.getState().setPreview(NO_SPOTLIGHT);
    },
    [],
  );
  return {
    onPointerEnter: (e) => {
      if (e.pointerType === "touch") return;
      hovering.current = true;
      useAnalyticsStore.getState().setPreview(target);
    },
    onPointerLeave: () => {
      if (!hovering.current) return;
      hovering.current = false;
      useAnalyticsStore.getState().setPreview(NO_SPOTLIGHT);
    },
  };
}

/**
 * The single click-to-spotlight control shared by every tab: a button that names elements of the
 * net. Resting the mouse on it lights `target` on the canvas at once, and leaving clears that; a
 * click keeps them lit and pans the canvas to them (a second click turns it off). Amber while kept.
 * With nothing to light it renders a plain element, so an empty witness (a deadlock at the all-zero
 * marking) never looks clickable. `kind` adds the mark of a single element's kind; `layout="row"`
 * makes a full-width block for a multi-line entry (an invariant, a loop, a deadlock marking).
 * `highlightKey` names the result when another result could light the same elements (two deadlock
 * markings with the same marked places), so only the clicked one reads as pressed.
 */
export function HighlightChip({
  target,
  highlightKey,
  kind,
  layout = "chip",
  children,
}: {
  target: Spotlight;
  highlightKey?: string;
  kind?: ElementKind;
  layout?: "chip" | "row";
  children: ReactNode;
}): JSX.Element {
  const key = highlightKey ?? spotlightKey(target);
  const active = useAnalyticsStore((s) => s.highlightKey === key);
  const hover = useHoverPreview(target);
  const shape =
    layout === "chip"
      ? "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-sm"
      : "flex w-full flex-col rounded border px-2 py-1 text-left text-sm";
  const content = (
    <>
      {kind && <ElementMark kind={kind} />}
      {children}
    </>
  );
  if (target.nodes.length === 0 && target.arcs.length === 0) {
    return <div className={`${shape} border-slate-200 bg-slate-50 text-slate-800`}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={() => useAnalyticsStore.getState().toggleHighlight(target, key)}
      {...hover}
      aria-pressed={active}
      className={`${shape} transition-colors ${
        active
          ? "border-amber-400 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-amber-300 hover:bg-amber-50"
      }`}
    >
      {content}
    </button>
  );
}

/** A chip for one place or transition, by id. */
export function ElementChip({
  id,
  kind,
  name,
}: {
  id: string;
  kind: "place" | "transition";
  name: string;
}): JSX.Element {
  return (
    <HighlightChip target={{ nodes: [id], arcs: [] }} kind={kind}>
      {name}
    </HighlightChip>
  );
}

/** A small secondary button for a copy action inside a card. */
export function CopyButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 text-sm hover:bg-slate-100"
    >
      {children}
    </button>
  );
}
