import { ReactFlowProvider } from "@xyflow/react";
import { type JSX, useEffect } from "react";
import { Canvas } from "@/flow/Canvas";
import { useBuildStore } from "@/store/buildStore";
import { netHistory, useNetStore } from "@/store/netStore";
import { AnalyticsPanel } from "@/ui/analytics/AnalyticsPanel";
import { Palette } from "@/ui/Palette";
import { PropertiesPanel } from "@/ui/PropertiesPanel";
import { SidebarFooter } from "@/ui/SidebarFooter";
import { Toolbar } from "@/ui/Toolbar";

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el !== null &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true)
  );
}

export default function App(): JSX.Element {
  const buildMode = useNetStore((s) => s.mode === "build");
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTextEntry(e.target)) return;
      // Undo/redo and delete all mutate the net; Simulate locks structural editing.
      if (useNetStore.getState().mode !== "build") return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) netHistory.redo();
        else netHistory.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        netHistory.redo();
      } else if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        useNetStore.getState().copy();
      } else if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        useNetStore.getState().paste();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useNetStore.getState().removeSelected();
      } else if (e.key === "Enter") {
        // A single selected place/transition: jump focus into the Properties Name field to rename.
        const { selection } = useNetStore.getState();
        if (selection.nodes.length === 1 && selection.edges.length === 0) {
          e.preventDefault();
          useBuildStore.getState().requestNameFocus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col">
      <Toolbar />
      <ReactFlowProvider>
        <div className="flex min-h-0 flex-1">
          <aside className="relative z-10 flex w-52 shrink-0 flex-col border-slate-300 border-r-[3px] bg-slate-50 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.15)]">
            {buildMode && <Palette />}
            <PropertiesPanel />
            <SidebarFooter />
          </aside>
          <div className="relative min-w-0 flex-1">
            <Canvas />
            <AnalyticsPanel />
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
