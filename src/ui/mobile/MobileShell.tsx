import { ReactFlowProvider } from "@xyflow/react";
import type { JSX } from "react";
import { Canvas } from "@/flow/Canvas";
import { useBuildStore } from "@/store/buildStore";
import { AnalyticsPanel } from "@/ui/analytics/AnalyticsPanel";
import { MobilePropertiesSheet } from "@/ui/mobile/MobilePropertiesSheet";
import { MobileToolDock } from "@/ui/mobile/MobileToolDock";
import { MobileTopBar } from "@/ui/mobile/MobileTopBar";

/**
 * The mobile app shell (≤767px): a condensed top bar over a full-bleed canvas, with the palette /
 * transport as a bottom dock, the contextual editor as a bottom sheet, and analytics as a
 * full-screen overlay. The canvas region `isolate`s its own stacking context so the top bar (and its
 * dropdown menu) stay above the full-screen analytics, while the dock/sheet stack under it.
 */
export function MobileShell(): JSX.Element {
  return (
    <div className="app-h-dynamic flex w-full flex-col overflow-hidden">
      <MobileTopBar />
      <ReactFlowProvider>
        <div className="relative isolate min-h-0 flex-1">
          <Canvas />
          <AnalyticsPanel />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col">
            <ArcCancelPill />
            <MobilePropertiesSheet />
            <MobileToolDock />
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}

/** Shown while an arc draw is in progress: a hint plus a cancel button (touch has no Esc). */
function ArcCancelPill(): JSX.Element | null {
  const drafting = useBuildStore((s) => s.draft !== null);
  if (!drafting) return null;
  return (
    <div className="mb-2 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line-strong bg-surface/95 px-4 py-2 text-fg-soft text-sm shadow-lg backdrop-blur">
        <span>Tap a target node</span>
        <button
          type="button"
          onClick={() => useBuildStore.getState().cancelArc()}
          className="touch-manipulation rounded-full bg-accent px-3 py-1 font-medium text-on-accent text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
