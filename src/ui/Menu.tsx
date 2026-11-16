import {
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CheckIcon } from "@/ui/icons";

/** One entry of a {@link Menu}: an action, or a link when `href` is set. */
export interface MenuEntry {
  label: string;
  /** A short second line under the label. */
  hint?: string;
  /**
   * Runs inside the click handler, so an action that needs the visitor's click (a clipboard
   * write, a file picker) is allowed by the browser. On a link it runs before the link opens.
   */
  onSelect?: () => void;
  /** Turns the entry into a link that opens in a new tab. */
  href?: string;
  disabled?: boolean;
  /**
   * Set on every entry of a choice, such as a theme switch. `true` shows a check mark and tells
   * screen readers that this entry is the current choice.
   */
  selected?: boolean;
}

/** A run of entries, with an optional visible heading. A line separates it from the run above. */
export interface MenuSection {
  label?: string;
  entries: MenuEntry[];
}

/** The props a {@link Menu} trigger spreads onto its own `<button>`. */
export interface MenuTriggerProps {
  ref: RefObject<HTMLButtonElement>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

/** Which item takes the focus when the menu opens; `null` while it is closed. */
type OpenAt = "first" | "last" | null;

const ITEM_SELECTOR = '[role^="menuitem"]:not([disabled])';

/**
 * A dropdown menu under a trigger button, built on the WAI-ARIA menu button pattern.
 *
 * The trigger is rendered by `children`, which receives the {@link MenuTriggerProps} to spread
 * onto a `<button>` and whether the menu is open: `<Menu sections={...}>{(t) => <button {...t} />}</Menu>`.
 *
 * Keyboard: Enter, Space or Arrow Down on the trigger opens the menu on its first entry, Arrow Up on
 * its last. Arrow keys, Home and End move between entries. Escape closes the menu and returns the
 * focus to the trigger. Tab closes it and moves on. A click outside closes it too.
 */
export function Menu({
  sections,
  align = "start",
  children,
}: {
  sections: MenuSection[];
  /** The side of the trigger that the menu lines up with. */
  align?: "start" | "end";
  children: (trigger: MenuTriggerProps, open: boolean) => ReactNode;
}): JSX.Element {
  const id = useId();
  const triggerId = `${id}trigger`;
  const menuId = `${id}menu`;
  const [openAt, setOpenAt] = useState<OpenAt>(null);
  const open = openAt !== null;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Opening moves the focus into the menu, so the arrow keys work at once.
  useEffect(() => {
    if (openAt === null) return;
    const items = menuItems(menuRef.current);
    (openAt === "last" ? items[items.length - 1] : items[0])?.focus();
  }, [openAt]);

  // While open, close on a click outside, and on Escape from anywhere.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenAt(null);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      setOpenAt(null);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const trigger: MenuTriggerProps = {
    ref: triggerRef,
    id: triggerId,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "aria-controls": open ? menuId : undefined,
    onClick: () => setOpenAt((at) => (at === null ? "first" : null)),
    onKeyDown: (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpenAt(e.key === "ArrowDown" ? "first" : "last");
      }
    },
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "Tab") {
      setOpenAt(null);
      return;
    }
    const items = menuItems(menuRef.current);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number | undefined> = {
      ArrowDown: (at + 1) % items.length,
      ArrowUp: (at - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const onActivate = (entry: MenuEntry, e: MouseEvent<HTMLElement>): void => {
    entry.onSelect?.();
    setOpenAt(null);
    // A keyboard press (a click with no pointer detail) returns the focus to the trigger.
    if (e.detail === 0) triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      {children(trigger, open)}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full z-30 mt-1 flex max-h-[70vh] w-max min-w-48 max-w-[calc(100vw-1rem)] flex-col overflow-auto overscroll-contain rounded border border-slate-300 bg-white py-1 shadow-lg outline-none ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          {sections.map((section, index) => (
            <Section
              key={section.label ?? section.entries[0]?.label}
              section={section}
              separated={index > 0}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
}

function Section({
  section,
  separated,
  onActivate,
}: {
  section: MenuSection;
  separated: boolean;
  onActivate: (entry: MenuEntry, e: MouseEvent<HTMLElement>) => void;
}): JSX.Element {
  const headingId = useId();
  const items = section.entries.map((entry) => (
    <Item key={entry.label} entry={entry} onActivate={onActivate} />
  ));
  return (
    <>
      {separated && <hr className="my-1 shrink-0 border-slate-200" />}
      {section.label ? (
        // biome-ignore lint/a11y/useSemanticElements: inside a menu a labelled group is the ARIA pattern; a fieldset belongs to forms.
        <div role="group" aria-labelledby={headingId} className="flex flex-col">
          <div
            id={headingId}
            role="presentation"
            className="px-3 pt-1.5 pb-1 font-semibold text-slate-500 text-xs uppercase tracking-wide"
          >
            {section.label}
          </div>
          {items}
        </div>
      ) : (
        items
      )}
    </>
  );
}

const ITEM_CLASS =
  "flex w-full items-start gap-2 px-3 py-2 text-left text-slate-700 text-sm outline-none hover:bg-slate-100 focus-visible:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 md:py-1.5";

function Item({
  entry,
  onActivate,
}: {
  entry: MenuEntry;
  onActivate: (entry: MenuEntry, e: MouseEvent<HTMLElement>) => void;
}): JSX.Element {
  const hintId = useId();
  const choice = entry.selected !== undefined;
  const common = {
    role: choice ? "menuitemradio" : "menuitem",
    "aria-checked": choice ? entry.selected : undefined,
    // The name is the label alone; the hint is read as the description.
    "aria-label": entry.label,
    "aria-describedby": entry.hint ? hintId : undefined,
    tabIndex: -1,
    className: ITEM_CLASS,
    onClick: (e: MouseEvent<HTMLElement>) => onActivate(entry, e),
  };
  const content = (
    <>
      {choice && (
        <span className="mt-0.5 flex h-4 w-4 shrink-0">
          {entry.selected && <CheckIcon className="h-4 w-4" />}
        </span>
      )}
      <span className="flex flex-col">
        <span>{entry.label}</span>
        {entry.hint && (
          <span id={hintId} className="text-slate-500 text-xs">
            {entry.hint}
          </span>
        )}
      </span>
    </>
  );
  return entry.href ? (
    <a {...common} href={entry.href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <button {...common} type="button" disabled={entry.disabled}>
      {content}
    </button>
  );
}
