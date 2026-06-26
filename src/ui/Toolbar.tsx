import type { JSX } from "react";
import type { PetriNet } from "@/domain/types";
import { NpnFile } from "@/lib/download";
import { netHistory, useNetStore, useTemporal } from "@/store/netStore";

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

/** Top bar: New / Import / Export and undo / redo (reactive to history depth). */
export function Toolbar(): JSX.Element {
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  return (
    <header className="flex items-center gap-2 border-slate-200 border-b bg-white px-3 py-2">
      <span className="mr-2 font-semibold text-slate-800 text-sm">Petri Net Editor</span>
      <ToolbarButton onClick={newNet}>New</ToolbarButton>
      <ToolbarButton onClick={importNet}>Import</ToolbarButton>
      <ToolbarButton onClick={exportNet}>Export</ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <ToolbarButton onClick={netHistory.undo} disabled={!canUndo}>
        Undo
      </ToolbarButton>
      <ToolbarButton onClick={netHistory.redo} disabled={!canRedo}>
        Redo
      </ToolbarButton>
    </header>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 text-sm shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
