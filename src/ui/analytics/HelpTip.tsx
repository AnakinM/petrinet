import {
  type JSX,
  type PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { HELP_TEXTS, type HelpTopic } from "@/ui/analytics/helpTexts";
import {
  type Box,
  type FloatingAlign,
  FloatingPlacement,
  type Placement,
} from "@/ui/floatingPlacement";

/** How the card was opened. It decides what closes it again. */
type OpenedBy = "mouse" | "touch" | "keyboard";

interface OpenCard {
  anchor: Box;
  align: FloatingAlign;
  by: OpenedBy;
}

/**
 * The anchor for a card opened by the mouse: a small box just right of the pointer whose bottom edge
 * sits below the cursor's arrow, so the card appears below and to the right of it, uncovered.
 */
function pointerAnchor(e: PointerEvent<HTMLElement>): Box {
  return { left: e.clientX + 12, top: e.clientY, width: 0, height: 14 };
}

/**
 * The "?" icon beside a term in the Analysis panel, and the help card it opens: the term as a heading,
 * then what it means, what it tells you and an example (from {@link HELP_TEXTS}).
 *
 * - Mouse: the card opens at once when the pointer enters the icon, below and right of the pointer,
 *   and stays still. It closes when the pointer leaves. A mouse click does nothing.
 * - Touch: a tap on the icon opens or closes the card. A tap anywhere else, or a scroll, closes it.
 * - Keyboard: focus opens the card next to the icon. Blur or Escape closes it.
 *
 * The pointer type of the event tells mouse from touch. The card renders through a portal with fixed
 * positioning, placed by {@link FloatingPlacement}, so it stays inside the viewport and the scrolling
 * panel never clips it. It holds no links or buttons: nobody could reach them before it closes.
 */
export function HelpTip({ topic }: { topic: HelpTopic }): JSX.Element {
  const id = useId();
  const [card, setCard] = useState<OpenCard | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const iconRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // The pointer type of the last press on the icon, so its click knows whether a finger tapped it.
  const pressedWith = useRef<string | null>(null);

  const open = (next: OpenCard): void => {
    setPlacement(null);
    setCard(next);
  };
  const close = (): void => setCard(null);

  // Escape and a scroll close every card; a tap elsewhere closes a card that a tap opened.
  useEffect(() => {
    if (!card) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      // This Escape belongs to the card: it must not also leave a placing tool, cancel an arc or
      // clear the selection, whose listeners sit on the window.
      e.stopPropagation();
      setCard(null);
    };
    // A keyboard focus can scroll the panel to bring the icon into view, so that card follows the
    // icon. A card opened by the mouse or a finger closes on any scroll.
    const onScroll = (): void => {
      const icon = iconRef.current;
      if (card.by === "keyboard" && icon)
        setCard({ ...card, anchor: icon.getBoundingClientRect() });
      else setCard(null);
    };
    const onPointerDown = (e: globalThis.PointerEvent): void => {
      if (card.by === "touch" && !iconRef.current?.contains(e.target as Node)) setCard(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [card]);

  // Measure the rendered card, then place it next to its anchor.
  useLayoutEffect(() => {
    if (!card || !cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlacement(FloatingPlacement.place(card.anchor, { width, height }, viewport, card.align));
  }, [card]);

  const text = HELP_TEXTS[topic];
  return (
    <>
      <button
        ref={iconRef}
        type="button"
        aria-label={`Help: ${topic}`}
        aria-describedby={card ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "touch") return;
          pressedWith.current = null;
          open({ anchor: pointerAnchor(e), align: "start", by: "mouse" });
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") close();
        }}
        onPointerDown={(e) => {
          pressedWith.current = e.pointerType;
        }}
        onClick={(e) => {
          const touch = pressedWith.current === "touch";
          pressedWith.current = null;
          if (!touch) return;
          if (card) close();
          else
            open({ anchor: e.currentTarget.getBoundingClientRect(), align: "start", by: "touch" });
        }}
        onFocus={(e) => {
          // Keyboard focus only. A press focuses the icon too, and the mouse and touch rules own that.
          if (pressedWith.current !== null || !e.currentTarget.matches(":focus-visible")) return;
          open({ anchor: e.currentTarget.getBoundingClientRect(), align: "start", by: "keyboard" });
        }}
        onBlur={() => {
          if (card?.by !== "mouse") close();
        }}
        className="inline-flex h-[18px] w-[18px] shrink-0 cursor-help select-none items-center justify-center rounded-full border border-slate-500 bg-white font-semibold text-[13px] text-slate-600 leading-none hover:border-slate-700 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
      >
        ?
      </button>
      {card &&
        createPortal(
          <div
            ref={cardRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              left: placement?.left ?? 0,
              top: placement?.top ?? 0,
              visibility: placement ? "visible" : "hidden",
            }}
            className="pointer-events-none z-[60] flex w-[272px] flex-col gap-2 rounded-md border border-slate-300 bg-white p-3 text-left font-normal text-slate-700 text-sm normal-case leading-snug tracking-normal shadow-lg"
          >
            <p className="font-semibold text-base text-slate-900">{topic}</p>
            <HelpPart label="Meaning" text={text.meaning} />
            <HelpPart label="Tells you" text={text.tellsYou} />
            <HelpPart label="Example" text={text.example} />
          </div>,
          document.body,
        )}
    </>
  );
}

function HelpPart({ label, text }: { label: string; text: string }): JSX.Element {
  return (
    <div>
      <p className="font-semibold text-[13px] text-slate-500">{label}</p>
      <p>{text}</p>
    </div>
  );
}
