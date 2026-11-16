import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";
import { Analytics } from "@/lib/analytics";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { netHistory, useNetStore, useTemporal } from "@/store/netStore";
import { MenuIcon, RedoIcon, UndoIcon } from "@/ui/icons";
import { ModeToggle } from "@/ui/ModeToggle";
import {
  exportNet,
  exportPng,
  exportPnml,
  exportSvg,
  importNet,
  newNet,
} from "@/ui/toolbarActions";

const GUIDE_URL = "/guide";
const REPO_URL = "https://github.com/AnakinM/petrinet";
const NEW_ISSUE_URL = "https://github.com/AnakinM/petrinet/issues/new";

/**
 * Condensed top bar for the mobile shell: icon-only Undo/Redo (Build only), the Build↔Simulate
 * {@link ModeToggle}, and a hamburger menu holding the secondary actions that live in the desktop
 * toolbar and sidebar footer (the net-file exports, the Analytics toggle, and the Guide/GitHub
 * links). All actions come from the shared {@link exportNet} et al., so they match the desktop.
 */
export function MobileTopBar(): JSX.Element {
  const mode = useNetStore((s) => s.mode);
  const simulating = mode === "simulate";
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  return (
    <header className="relative z-40 flex items-center gap-1.5 border-slate-300 border-b-[3px] bg-white px-2 py-1.5 shadow-[0_4px_8px_-4px_rgba(15,23,42,0.15)]">
      <img
        src="/apple-touch-icon.png"
        alt=""
        width={26}
        height={26}
        className="h-[26px] w-[26px]"
      />
      {/* The site name is the page heading. "Editor" shows from 640 pixels up only: a phone's bar
          has no room for it. Screen readers and crawlers always get it. */}
      <h1 className="whitespace-nowrap font-semibold text-slate-800 text-sm">
        PetriNet <span className="sr-only sm:not-sr-only">Editor</span>
      </h1>
      {!simulating && (
        <>
          <IconButton onClick={netHistory.undo} disabled={!canUndo} label="Undo">
            <UndoIcon />
          </IconButton>
          <IconButton onClick={netHistory.redo} disabled={!canRedo} label="Redo">
            <RedoIcon />
          </IconButton>
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <ModeToggle mode={mode} />
        <Menu simulating={simulating} />
      </div>
    </header>
  );
}

/** The hamburger dropdown; closes on an outside tap or Escape (it has no backdrop of its own). */
function Menu({ simulating }: { simulating: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const analyticsOpen = useAnalyticsStore((s) => s.open);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run =
    (fn: () => void): (() => void) =>
    () => {
      fn();
      setOpen(false);
    };

  return (
    <div ref={ref} className="relative">
      <IconButton onClick={() => setOpen((o) => !o)} active={open} label="Menu">
        <MenuIcon />
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-1 flex max-h-[70vh] min-w-[12rem] flex-col overflow-auto overscroll-contain rounded border border-slate-300 bg-white py-1 shadow-lg">
          <MenuItem onClick={run(newNet)} disabled={simulating}>
            New
          </MenuItem>
          <MenuItem onClick={run(importNet)} disabled={simulating}>
            Import…
          </MenuItem>
          <MenuItem onClick={run(exportNet)}>Export .npn</MenuItem>
          <MenuItem onClick={run(exportPnml)}>Export PNML</MenuItem>
          <MenuItem onClick={run(exportPng)}>Export PNG</MenuItem>
          <MenuItem onClick={run(exportSvg)}>Export SVG</MenuItem>
          <Divider />
          <MenuItem onClick={run(() => useAnalyticsStore.getState().toggle())}>
            {analyticsOpen ? "Hide analytics" : "Show analytics"}
          </MenuItem>
          <Divider />
          <MenuLink href={GUIDE_URL}>Guide</MenuLink>
          <MenuLink
            href={REPO_URL}
            onClick={() => Analytics.track("Outbound link", { target: "github" })}
          >
            GitHub
          </MenuLink>
          <MenuLink
            href={NEW_ISSUE_URL}
            onClick={() => Analytics.track("Outbound link", { target: "issue" })}
          >
            Report an issue
          </MenuLink>
        </div>
      )}
    </div>
  );
}

/** A square icon-only top-bar button, sized for a comfortable touch target. */
function IconButton({
  onClick,
  disabled,
  active,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded border shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-slate-700 bg-slate-700 text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItem({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <a
      href={href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 py-2 text-left text-slate-700 text-sm hover:bg-slate-100"
    >
      {children}
    </a>
  );
}

function Divider(): JSX.Element {
  return <span className="my-1 h-px bg-slate-200" />;
}
