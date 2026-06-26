import type { JSX, ReactNode } from "react";
import type { PetriNet } from "@/domain/types";
import { NpnFile } from "@/lib/download";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useBuildStore } from "@/store/buildStore";
import { type Mode, netHistory, useNetStore, useTemporal } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";
import { ExportIcon, GridIcon, ImportIcon, NewIcon, RedoIcon, UndoIcon } from "@/ui/icons";

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
    <header className="flex items-center gap-2 border-slate-200 border-b bg-white px-3 py-2">
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
