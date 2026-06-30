import { type JSX, type ReactNode, useEffect, useRef, useState } from "react";
import type { PetriNet } from "@/domain/types";
import { ImageFile, NpnFile } from "@/lib/download";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useBuildStore } from "@/store/buildStore";
import { type Mode, netHistory, useNetStore, useTemporal } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";
import {
  ExportIcon,
  GridIcon,
  ImageIcon,
  ImportIcon,
  NewIcon,
  RedoIcon,
  UndoIcon,
} from "@/ui/icons";

const EMPTY_NET: PetriNet = { places: [], transitions: [], arcs: [] };

function newNet(): void {
  if (window.confirm("Discard the current net and start a new one?")) {
    useNetStore.getState().setNet(EMPTY_NET);
  }
}

function importNet(): void {
  NpnFile.open()
    .then(({ net }) => useNetStore.getState().setNet(net))
    .catch((error: Error) => window.alert(`Import failed: ${error.message}`));
}

function exportNet(): void {
  NpnFile.save(useNetStore.getState().net);
}

/**
 * The net to render to an image: M0 in Build, but the live working marking in Simulate, so the
 * export always matches what the user currently sees on the canvas.
 */
function imageNet(): PetriNet {
  const { net, mode } = useNetStore.getState();
  if (mode !== "simulate") return net;
  const { marking } = useSimStore.getState();
  return { ...net, places: net.places.map((p) => ({ ...p, tokens: marking[p.id] ?? p.tokens })) };
}

/** Enter Simulate: drop any active Build tool, clear the selection, lock the net, snapshot M0. */
function enterSimulate(): void {
  const store = useNetStore.getState();
  if (store.mode === "simulate") return;
  useBuildStore.getState().setTool("idle");
  store.select({ nodes: [], edges: [] });
  store.setMode("simulate");
  useSimStore.getState().start(store.net);
}

/** Return to Build and drop the simulation working copy. */
function enterBuild(): void {
  const store = useNetStore.getState();
  if (store.mode === "build") return;
  store.setMode("build");
  useSimStore.getState().stop();
}

/** Top bar: New / Import / Export, undo / redo, and the Build ↔ Simulate toggle. */
export function Toolbar(): JSX.Element {
  const mode = useNetStore((s) => s.mode);
  const simulating = mode === "simulate";
  const analyticsOpen = useAnalyticsStore((s) => s.open);
  const snap = useBuildStore((s) => s.snap);
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  return (
    <header className="relative z-20 flex items-center gap-2 border-slate-300 border-b-[3px] bg-white px-3 py-2 shadow-[0_4px_8px_-4px_rgba(15,23,42,0.15)]">
      <span className="mr-2 flex items-center gap-1.5">
        <img src="/apple-touch-icon.png" alt="" width={24} height={24} className="h-6 w-6" />
        <span className="font-semibold text-slate-800 text-sm">PetriNet</span>
      </span>
      <ToolbarButton onClick={newNet} disabled={simulating}>
        <NewIcon />
        New
      </ToolbarButton>
      <ToolbarButton onClick={importNet} disabled={simulating}>
        <ImportIcon />
        Import
      </ToolbarButton>
      <ToolbarButton onClick={exportNet}>
        <ExportIcon />
        Export
      </ToolbarButton>
      <ImageExportMenu />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton onClick={netHistory.undo} disabled={simulating || !canUndo}>
        <UndoIcon />
        Undo
      </ToolbarButton>
      <ToolbarButton onClick={netHistory.redo} disabled={simulating || !canRedo}>
        <RedoIcon />
        Redo
      </ToolbarButton>
      {!simulating && (
        <>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <ToolbarButton
            onClick={() => useBuildStore.getState().toggleSnap()}
            active={snap}
            ariaLabel="Snap to grid"
            title="Snap node placement and dragging to the grid"
          >
            <GridIcon />
          </ToolbarButton>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {simulating && (
          <ToolbarButton onClick={() => useSimStore.getState().reset()}>Reset</ToolbarButton>
        )}
        <ToolbarButton onClick={() => useAnalyticsStore.getState().toggle()} active={analyticsOpen}>
          Analytics
        </ToolbarButton>
        <ModeToggle mode={mode} />
      </div>
    </header>
  );
}

/** Export the current net as an image: a small dropdown offering PNG (raster) or SVG (vector). */
function ImageExportMenu(): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // While open, close on an outside click or Escape (the menu has no backdrop of its own).
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

  const exportAs = (kind: "png" | "svg"): void => {
    if (kind === "png") ImageFile.savePng(imageNet());
    else ImageFile.saveSvg(imageNet());
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <ToolbarButton
        onClick={() => setOpen((o) => !o)}
        active={open}
        title="Export the net as an image"
      >
        <ImageIcon />
        Image
      </ToolbarButton>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 flex min-w-[8rem] flex-col rounded border border-slate-300 bg-white py-1 shadow-lg">
          <MenuItem onClick={() => exportAs("png")}>PNG image</MenuItem>
          <MenuItem onClick={() => exportAs("svg")}>SVG vector</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 text-left text-slate-700 text-sm hover:bg-slate-100"
    >
      {children}
    </button>
  );
}

function ModeToggle({ mode }: { mode: Mode }): JSX.Element {
  return (
    <div className="flex overflow-hidden rounded border border-slate-300 text-sm">
      <ModeTab active={mode === "build"} onClick={enterBuild}>
        Build
      </ModeTab>
      <ModeTab active={mode === "simulate"} onClick={enterSimulate}>
        Simulate
      </ModeTab>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "bg-slate-700 px-3 py-1 text-white"
          : "bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel}
      title={title}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-700 px-2.5 py-1 text-sm text-white shadow-sm"
          : "inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 text-sm shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}
