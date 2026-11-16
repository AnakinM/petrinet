import { create } from "zustand";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult } from "@/domain/analysis/types";
import { Analytics } from "@/lib/analytics";
import { useNetStore } from "@/store/netStore";

/** Which Analysis panel tab is showing. */
export type AnalyticsTab =
  | "properties"
  | "classification"
  | "invariants"
  | "structure"
  | "reachability";

/** Every tab, in the order the panel shows them. A stored tab outside this list is ignored. */
export const ANALYTICS_TABS: readonly AnalyticsTab[] = [
  "properties",
  "classification",
  "invariants",
  "structure",
  "reachability",
];

/**
 * What the canvas lights for the analysis: places and transitions (`nodes`) and `arcs`, kept apart
 * because an imported arc may share its id with a node.
 */
export interface Spotlight {
  nodes: string[];
  arcs: string[];
}

/** Nothing lit. */
export const NO_SPOTLIGHT: Spotlight = { nodes: [], arcs: [] };

/** A key that is equal for two spotlights exactly when they light the same elements in the same order. */
export function spotlightKey(s: Spotlight): string {
  return JSON.stringify([s.nodes, s.arcs]);
}

/**
 * Analysis panel UI state, deliberately **separate from the net store and its zundo history**:
 * opening, resizing, and analysing never touch the net. The computed {@link AnalysisResult} is a
 * derived working value (recomputed live while the panel is open and **never persisted**). Only
 * `{ open, width, activeTab }` survive in `localStorage`.
 *
 * Two recompute cadences mirror the engine's two layers:
 *   - the **algebraic** slice is instant and stays live. It is refreshed on open and on every
 *     structural net edit, which also drops the results of the full analysis;
 *   - the **full analysis** (the reachability pass) is heavier and runs only when the visitor asks,
 *     through the Analyse button ({@link AnalyticsState.reanalyze}). It never runs by itself.
 */
export interface AnalyticsState {
  open: boolean;
  width: number;
  activeTab: AnalyticsTab;
  /** Latest analysis from M0: the algebraic slice, plus the full analysis once it has run. */
  result: AnalysisResult | null;
  /**
   * The net changed after a full analysis, so its results were dropped. False before the first full
   * analysis, so the Analyse bar can tell "never run" from "net changed".
   */
  stale: boolean;
  /** A full analysis is in flight (for the Web-Worker upgrade; synchronous today). */
  running: boolean;
  /**
   * What the canvas keeps lit: set by clicking a result (a dead transition, a loop, a heavy arc ...).
   * A separate channel from the editor's selection so it reads as "the analysis points here",
   * survives Simulate (where selection is off), and never edits the net. Only this one pans the canvas.
   */
  highlight: Spotlight;
  /** What the canvas lights while the pointer rests on a result. Transient, and it never pans. */
  preview: Spotlight;

  toggle: () => void;
  close: () => void;
  /** Set the panel width live (transient: does not persist; the drag calls {@link commitWidth} at the end). */
  setWidth: (width: number) => void;
  /** Persist the current width once, at the end of a resize drag. */
  commitWidth: () => void;
  setActiveTab: (tab: AnalyticsTab) => void;
  /** Refresh the instant algebraic slice from the current net; the full analysis resets to not run. */
  analyze: () => void;
  /** Run the full analysis (the reachability pass) for the current net and clear the stale flag. */
  reanalyze: () => void;
  /** Keep these elements lit on the canvas; passing the already-lit set turns the highlight off. */
  toggleHighlight: (target: Spotlight) => void;
  /** Light these elements while the pointer rests on them; {@link NO_SPOTLIGHT} clears it. */
  setPreview: (target: Spotlight) => void;
}

const STORAGE_KEY = "petrinet.analytics.v1";
/** The left sidebar (`w-52`) is the hard floor: the panel may occlude the canvas, never it. */
const SIDEBAR_PX = 208;
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 400;
const DEFAULT_TAB: AnalyticsTab = "invariants";

interface Persisted {
  open: boolean;
  width: number;
  activeTab: AnalyticsTab;
}

function clampWidth(width: number): number {
  const max =
    typeof window === "undefined" ? width : Math.max(MIN_WIDTH, window.innerWidth - SIDEBAR_PX);
  return Math.min(Math.max(width, MIN_WIDTH), max);
}

function loadPersisted(): Persisted {
  const fallback: Persisted = { open: false, width: DEFAULT_WIDTH, activeTab: DEFAULT_TAB };
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof data !== "object" || data === null) return fallback;
    const { open, width, activeTab } = data;
    return {
      open: open === true,
      width: clampWidth(
        typeof width === "number" && Number.isFinite(width) ? width : DEFAULT_WIDTH,
      ),
      // A tab stored by another version of the app, or edited by hand, falls back to the default.
      activeTab: ANALYTICS_TABS.find((tab) => tab === activeTab) ?? DEFAULT_TAB,
    };
  } catch {
    return fallback;
  }
}

function persist(state: AnalyticsState): void {
  if (typeof localStorage === "undefined") return;
  const data: Persisted = { open: state.open, width: state.width, activeTab: state.activeTab };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Instant slice: invariants, conservativeness, structural boundedness and net-graph diagnostics. */
function algebraicResult(): AnalysisResult {
  return NetAnalysis.analyze(useNetStore.getState().net, { behavioral: false });
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => {
  const persisted = loadPersisted();
  return {
    ...persisted,
    result: persisted.open ? algebraicResult() : null,
    stale: false,
    running: false,
    highlight: NO_SPOTLIGHT,
    preview: NO_SPOTLIGHT,

    toggle: () => {
      const open = !get().open;
      set({
        open,
        result: open ? algebraicResult() : get().result,
        stale: false,
        highlight: NO_SPOTLIGHT,
        preview: NO_SPOTLIGHT,
      });
      persist(get());
      // Visitor usage event. Restoring the panel as open at page load does not pass through here.
      if (open) Analytics.track("Open Analysis panel");
    },
    close: () => {
      set({ open: false, highlight: NO_SPOTLIGHT, preview: NO_SPOTLIGHT });
      persist(get());
    },
    // Persisting on every pointermove would thrash localStorage during a drag; commitWidth saves once.
    setWidth: (width) => set({ width: clampWidth(width) }),
    commitWidth: () => persist(get()),
    setActiveTab: (activeTab) => {
      // A highlight belongs to the result that lit it; leaving its tab drops it.
      set({ activeTab, highlight: NO_SPOTLIGHT, preview: NO_SPOTLIGHT });
      persist(get());
    },
    toggleHighlight: (target) => {
      const same = spotlightKey(target) === spotlightKey(get().highlight);
      set({ highlight: same ? NO_SPOTLIGHT : target });
    },
    setPreview: (preview) => set({ preview }),
    analyze: () => set({ result: algebraicResult(), stale: false }),
    reanalyze: () => {
      // Synchronous in v1 (cap-bounded); `running` brackets the call for the Web-Worker upgrade that
      // will make it async. Both sets land before React repaints today, so no flicker.
      set({ running: true });
      // The live `result` already holds this net's algebraic slice (the subscription keeps it
      // current), so thread it straight in. Only the reachability-derived fields recompute.
      const algebraic = get().result ?? algebraicResult();
      set({
        result: NetAnalysis.behavioral(useNetStore.getState().net, algebraic),
        stale: false,
        running: false,
      });
    },
  };
});

// Keep the instant algebraic slice live while the panel is open. A structural edit drops the full
// analysis (its verdicts and witnesses belong to the old net), and marks the results stale when a
// full analysis had run, so the Analyse bar says the net changed. The net reference only changes in
// Build (Simulate edits a separate working copy), so results never go stale in Simulate.
//
// A position/label/rotation nudge mints a new net reference but cannot change any verdict, so it is
// filtered out by comparing structural signatures. Otherwise dragging a node would discard valid
// results and force an expensive re-run.
useNetStore.subscribe((state, prev) => {
  if (state.net === prev.net) return;
  const { open, result, stale } = useAnalyticsStore.getState();
  if (!open) return;
  if (NetAnalysis.signature(state.net) === NetAnalysis.signature(prev.net)) return;
  // A structural edit can delete a lit element or invalidate the result that lit it, so drop the
  // highlight along with refreshing the algebraic slice. A cosmetic nudge (same signature) is
  // filtered above, so the spotlight follows a dragged/renamed node unchanged.
  useAnalyticsStore.setState({
    result: algebraicResult(),
    stale: stale || result?.placeBounds != null,
    highlight: NO_SPOTLIGHT,
    preview: NO_SPOTLIGHT,
  });
});
