import {
  type FocusEvent,
  type JSX,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type Box, FloatingPlacement, type Placement } from "@/ui/floatingPlacement";

/** Hover time before the label shows. Keyboard focus shows it at once. */
export const TOOLTIP_DELAY_MS = 300;

/**
 * `useLayoutEffect` in the browser. The build renders the guide to HTML where there is no document
 * and no layout; React warns about a layout effect there, and the label never shows there anyway.
 */
const useBrowserLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * The props a {@link Tooltip} trigger spreads onto its own focusable element. They use
 * `onClickCapture`, so the trigger keeps its own `onClick` untouched.
 */
export interface TooltipTriggerProps {
  "aria-describedby": string | undefined;
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  onClickCapture: () => void;
}

/**
 * A quick tooltip: a small dark label under its trigger. It shows after {@link TOOLTIP_DELAY_MS} of
 * mouse hover, and at once on keyboard focus. It hides on pointer leave, blur, Escape and click. The
 * label renders through a portal with fixed positioning, placed by {@link FloatingPlacement}, so no
 * container clips it and it stays inside the viewport.
 *
 * The trigger is rendered by `children`, which receives the {@link TooltipTriggerProps} to spread
 * onto the focusable element: `<Tooltip label="...">{(t) => <button {...t} />}</Tooltip>`.
 * `suppressed` keeps the label hidden, for example while the trigger's own menu is open below it.
 */
export function Tooltip({
  label,
  suppressed = false,
  children,
}: {
  label: string;
  suppressed?: boolean;
  children: (trigger: TooltipTriggerProps) => ReactNode;
}): JSX.Element {
  const id = useId();
  const [anchor, setAnchor] = useState<Box | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Set between pointer down and up, so the focus that a mouse press gives does not show the label.
  const pressed = useRef(false);

  const show = (rect: Box): void => {
    setPlacement(null);
    setAnchor(rect);
  };
  const hide = (): void => {
    clearTimeout(timer.current);
    setAnchor(null);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  // While shown, Escape hides the label even when the trigger has no focus (mouse hover).
  useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setAnchor(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anchor]);

  // Measure the rendered label, then place it next to the anchor.
  useBrowserLayoutEffect(() => {
    if (!anchor || suppressed || !labelRef.current) return;
    const { width, height } = labelRef.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    setPlacement(FloatingPlacement.place(anchor, { width, height }, viewport));
  }, [anchor, suppressed]);

  const visible = anchor !== null && !suppressed;
  const trigger: TooltipTriggerProps = {
    "aria-describedby": visible ? id : undefined,
    onPointerEnter: (e) => {
      if (e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => show(rect), TOOLTIP_DELAY_MS);
    },
    onPointerLeave: () => {
      pressed.current = false;
      hide();
    },
    onPointerDown: () => {
      pressed.current = true;
      hide();
    },
    onPointerUp: () => {
      pressed.current = false;
    },
    onFocus: (e) => {
      // Keyboard focus only: the browser does not mark a focus as visible when a script moves it
      // after a mouse click, as a menu does when it hands the focus back to its trigger.
      if (pressed.current || !e.currentTarget.matches(":focus-visible")) return;
      show(e.currentTarget.getBoundingClientRect());
    },
    onBlur: hide,
    onClickCapture: hide,
  };

  return (
    <>
      {children(trigger)}
      {visible &&
        createPortal(
          <div
            ref={labelRef}
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              left: placement?.left ?? 0,
              top: placement?.top ?? 0,
              visibility: placement ? "visible" : "hidden",
            }}
            className="pointer-events-none z-50 max-w-xs rounded bg-slate-800 px-2 py-1 text-sm text-white shadow-md"
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  );
}
