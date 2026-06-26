import { ReactFlowProvider } from "@xyflow/react";
import { type JSX, useEffect } from "react";
import { Canvas } from "@/flow/Canvas";
import { netHistory, useNetStore } from "@/store/netStore";
import { Palette } from "@/ui/Palette";
import { PropertiesPanel } from "@/ui/PropertiesPanel";
import { Toolbar } from "@/ui/Toolbar";

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    el !== null &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true)
  );
}

export default function App(): JSX.Element {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTextEntry(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) netHistory.redo();
        else netHistory.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        netHistory.redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (useNetStore.getState().mode !== "build") return;
        e.preventDefault();
        useNetStore.getState().removeSelected();
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
          <Palette />
          <div className="min-w-0 flex-1">
            <Canvas />
          </div>
          <PropertiesPanel />
        </div>
      </ReactFlowProvider>
    </div>
  );
}
