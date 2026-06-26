import { type JSX, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import type { AnalysisResult } from "@/domain/analysis/types";
import { type AnalyticsTab, useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { InvariantsTab } from "@/ui/analytics/InvariantsTab";
import { PropertiesTab } from "@/ui/analytics/PropertiesTab";
import { StructureTab } from "@/ui/analytics/StructureTab";

/**
 * Resizable right-side overlay rendering the current net's analysis. It floats above the canvas
 * (which keeps its size underneath), anchored to the canvas's right edge, so the left sidebar
 * always stays visible. Closed ⇒ renders nothing.
 */
export function AnalyticsPanel(): JSX.Element | null {
  const open = useAnalyticsStore((s) => s.open);
  const width = useAnalyticsStore((s) => s.width);
  const activeTab = useAnalyticsStore((s) => s.activeTab);
  const result = useAnalyticsStore((s) => s.result);
  const net = useNetStore((s) => s.net);

  // Shrinking the viewport can leave the persisted width wider than the canvas now allows; re-clamp
  // it (transiently — the load-time clamp persists the correction) so the panel never occludes the
  // sidebar. setWidth re-runs the same clamp against the new innerWidth.
  useEffect(() => {
    const onResize = (): void => {
      useAnalyticsStore.getState().setWidth(useAnalyticsStore.getState().width);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!open) return null;
  const empty = net.places.length === 0 && net.transitions.length === 0;

  return (
    <aside
      style={{ width }}
      className="absolute inset-y-0 right-0 z-10 flex flex-col border-slate-200 border-l bg-white shadow-lg"
    >
      <ResizeHandle />
      <PanelHeader activeTab={activeTab} />
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {empty || result === null ? (
          <p className="text-slate-400 text-sm">Nothing to analyse — add places and transitions.</p>
        ) : (
          <TabBody tab={activeTab} result={result} />
        )}
      </div>
    </aside>
  );
}

function TabBody({ tab, result }: { tab: AnalyticsTab; result: AnalysisResult }): JSX.Element {
  if (tab === "properties") return <PropertiesTab result={result} />;
  if (tab === "invariants") return <InvariantsTab result={result} />;
  return <StructureTab result={result} />;
}

function PanelHeader({ activeTab }: { activeTab: AnalyticsTab }): JSX.Element {
  const stale = useAnalyticsStore((s) => s.stale);
  return (
    <div className="shrink-0 border-slate-200 border-b">
      <div className="flex items-center gap-2 px-3 py-2">
        <h2 className="font-semibold text-slate-800 text-sm">Analytics</h2>
        {stale && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 text-xs">
            Stale
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => useAnalyticsStore.getState().reanalyze()}
            className="rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 text-xs hover:bg-slate-100"
          >
            Re-analyze
          </button>
          <button
            type="button"
            onClick={() => useAnalyticsStore.getState().close()}
            aria-label="Close analytics"
            className="rounded px-1.5 text-lg text-slate-400 leading-none hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex gap-1 px-2 pb-2">
        <TabButton tab="properties" active={activeTab === "properties"}>
          Properties
        </TabButton>
        <TabButton tab="invariants" active={activeTab === "invariants"}>
          Invariants
        </TabButton>
        <TabButton tab="structure" active={activeTab === "structure"}>
          Structure
        </TabButton>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  children,
}: {
  tab: AnalyticsTab;
  active: boolean;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => useAnalyticsStore.getState().setActiveTab(tab)}
      aria-pressed={active}
      className={
        active
          ? "rounded bg-slate-700 px-2.5 py-1 font-medium text-white text-xs"
          : "rounded px-2.5 py-1 font-medium text-slate-600 text-xs hover:bg-slate-100"
      }
    >
      {children}
    </button>
  );
}

/**
 * Gutter on the panel's left border: full-height double rails with an always-visible triple-dot
 * grip at mid-height, over a ~9px `col-resize` hit-area. Highlights blue on hover and stays lit
 * while dragging (the pointer leaves the strip mid-drag, so hover alone won't hold). Drag to
 * resize (pointer-only in v1).
 */
function ResizeHandle(): JSX.Element {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onPointerDown={(e) => {
        setDragging(true);
        startResize(e, () => setDragging(false));
      }}
      title="Drag to resize"
      className={`absolute inset-y-0 left-0 z-10 flex w-[9px] cursor-col-resize items-center justify-center ${
        dragging ? "bg-blue-300" : "hover:bg-blue-300"
      }`}
    >
      <span className="-translate-x-1/2 absolute inset-y-0 left-1/2 flex gap-[5px]">
        <span className="w-px bg-slate-300" />
        <span className="w-px bg-slate-300" />
      </span>
      <span className="relative flex flex-col gap-[3px] rounded-sm bg-white p-[2px]">
        <span className="h-[2px] w-[2px] rounded-full bg-slate-400" />
        <span className="h-[2px] w-[2px] rounded-full bg-slate-400" />
        <span className="h-[2px] w-[2px] rounded-full bg-slate-400" />
      </span>
    </div>
  );
}

function startResize(e: ReactPointerEvent, onDone: () => void): void {
  e.preventDefault();
  const onMove = (ev: globalThis.PointerEvent): void => {
    useAnalyticsStore.getState().setWidth(window.innerWidth - ev.clientX);
  };
  const onUp = (): void => {
    useAnalyticsStore.getState().commitWidth();
    onDone();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
