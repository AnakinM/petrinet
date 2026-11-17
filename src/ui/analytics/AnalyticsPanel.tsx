import { type JSX, memo, type PointerEvent as ReactPointerEvent, useEffect, useState } from "react";
import { AnalysisReport } from "@/domain/analysis/analysisReport";
import type { AnalysisResult } from "@/domain/analysis/types";
import { ANALYTICS_TABS, type AnalyticsTab, useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { ClassificationTab } from "@/ui/analytics/ClassificationTab";
import { copyResults } from "@/ui/analytics/copyActions";
import { InvariantsTab } from "@/ui/analytics/InvariantsTab";
import { PropertiesTab } from "@/ui/analytics/PropertiesTab";
import { ReachabilityTab } from "@/ui/analytics/ReachabilityTab";
import { StructureTab } from "@/ui/analytics/StructureTab";
import { useIsMobile } from "@/ui/useIsMobile";

const TAB_LABELS: Record<AnalyticsTab, string> = {
  properties: "Properties",
  classification: "Classification",
  invariants: "Invariants",
  structure: "Structure",
  reachability: "Reachability",
};

/**
 * Resizable right-side overlay rendering the current net's analysis. It floats above the canvas
 * (which keeps its size underneath), anchored to the canvas's right edge, so the left sidebar
 * always stays visible. Closed ⇒ renders nothing. Under the tabs, the Analyse bar runs the full
 * analysis on request and says whether its results are current.
 */
export function AnalyticsPanel(): JSX.Element | null {
  const isMobile = useIsMobile();
  const open = useAnalyticsStore((s) => s.open);
  const width = useAnalyticsStore((s) => s.width);
  const activeTab = useAnalyticsStore((s) => s.activeTab);
  const result = useAnalyticsStore((s) => s.result);
  const net = useNetStore((s) => s.net);

  // Shrinking the viewport can leave the persisted width wider than the canvas now allows; re-clamp
  // it (transiently: the load-time clamp persists the correction) so the panel never occludes the
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
  const ready = !empty && result !== null;

  return (
    <aside
      style={isMobile ? undefined : { width }}
      className={
        isMobile
          ? "absolute inset-0 z-50 flex flex-col bg-white"
          : "absolute inset-y-0 right-0 z-10 flex flex-col border-slate-300 border-l-[3px] bg-white shadow-lg"
      }
    >
      {/* Desktop floats a resizable right rail; mobile takes over the canvas area full-screen. */}
      {!isMobile && <ResizeHandle />}
      <PanelHeader activeTab={activeTab} canCopy={ready} />
      {ready && <AnalyseBar result={result} />}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-50/60 p-4">
        {ready ? (
          <TabBody tab={activeTab} result={result} />
        ) : (
          <p className="text-base text-slate-500">
            Nothing to analyse. Add places and transitions.
          </p>
        )}
      </div>
    </aside>
  );
}

/**
 * The active tab. Memoised, so a resize drag (which re-renders the panel on every pointer move)
 * does not re-render the 200-row state table or the incidence matrix.
 */
const TabBody = memo(function TabBody({
  tab,
  result,
}: {
  tab: AnalyticsTab;
  result: AnalysisResult;
}): JSX.Element {
  if (tab === "properties") return <PropertiesTab result={result} />;
  if (tab === "classification") return <ClassificationTab />;
  if (tab === "invariants") return <InvariantsTab result={result} />;
  if (tab === "reachability") return <ReachabilityTab result={result} />;
  return <StructureTab result={result} />;
});

function PanelHeader({
  activeTab,
  canCopy,
}: {
  activeTab: AnalyticsTab;
  canCopy: boolean;
}): JSX.Element {
  return (
    <div className="shrink-0 border-slate-200 border-b">
      <div className="flex items-center gap-2 px-4 py-2">
        <h2 className="font-semibold text-base text-slate-900">Analysis</h2>
        <div className="ml-auto flex items-center gap-1">
          {canCopy && (
            <button
              type="button"
              onClick={copyResults}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 text-sm hover:bg-slate-100"
            >
              Copy results
            </button>
          )}
          <button
            type="button"
            onClick={() => useAnalyticsStore.getState().close()}
            aria-label="Close analysis"
            className="rounded px-1.5 text-2xl text-slate-500 leading-none hover:bg-slate-100 hover:text-slate-800"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-4 pb-2">
        {ANALYTICS_TABS.map((tab) => (
          <TabButton key={tab} tab={tab} active={activeTab === tab}>
            {TAB_LABELS[tab]}
          </TabButton>
        ))}
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
          ? "rounded bg-slate-700 px-2.5 py-1 font-medium text-sm text-white"
          : "rounded px-2.5 py-1 font-medium text-slate-700 text-sm hover:bg-slate-100"
      }
    >
      {children}
    </button>
  );
}

/**
 * The bar across the top of every tab. Before the full analysis has run for this net it asks for
 * it; after an edit it says the net changed; once the results are current it turns into a quiet line
 * with the number of explored markings. The full analysis never runs by itself.
 */
function AnalyseBar({ result }: { result: AnalysisResult }): JSX.Element {
  const stale = useAnalyticsStore((s) => s.stale);
  if (!stale && result.placeBounds !== null) {
    return (
      <p className="shrink-0 border-slate-200 border-b px-4 py-2 text-slate-600 text-sm">
        {AnalysisReport.upToDate(result)}
      </p>
    );
  }
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 ${
        stale ? "border-amber-300 bg-amber-50" : "border-blue-200 bg-blue-50"
      }`}
    >
      {/* The text keeps at least 12rem, so in a narrow panel the button wraps under it. */}
      <p className="min-w-0 shrink grow basis-48 text-base text-slate-900">
        {stale
          ? "The net changed. The results may be out of date."
          : "Some results need the full analysis."}
      </p>
      <button
        type="button"
        onClick={() => useAnalyticsStore.getState().reanalyze()}
        className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-base text-white shadow-sm hover:bg-blue-700"
      >
        {stale ? "Analyse again" : "Analyse"}
      </button>
    </div>
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
