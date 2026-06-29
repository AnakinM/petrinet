import { create } from "zustand";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult } from "@/domain/analysis/types";
import { useNetStore } from "@/store/netStore";

/** Which analytics tab is showing. */
export type AnalyticsTab = "properties" | "invariants" | "structure";

/**
 * Analytics-panel UI state, deliberately **separate from the net store and its zundo history**:
 * opening, resizing, and analysing never touch the net. The computed {@link AnalysisResult} is a
 * derived working value — recomputed live while the panel is open and **never persisted**; only
 * `{ open, width, activeTab }` survive in `localStorage`.
 *
 * Two recompute cadences mirror the engine's two layers (spec §4):
 *   - the **algebraic** slice is instant and stays live — it is refreshed on open and on every net
 *     edit (which also marks the behavioural verdicts {@link AnalyticsState.stale});
 *   - the **behavioural** pass is heavier and runs **on demand** via {@link AnalyticsState.reanalyze}
 *     (the Re-analyze button), which clears the stale flag.
 */
export interface AnalyticsState {
  open: boolean;
  width: number;
  activeTab: AnalyticsTab;
  /** Latest analysis from M0; the algebraic slice while live, the full result after Re-analyze. */
  result: AnalysisResult | null;
  /** The net changed since the last behavioural pass, so those verdicts are out of date. */
  stale: boolean;
  /** A behavioural pass is in flight (for the Web-Worker upgrade, §9; synchronous today). */
  running: boolean;
  /**
   * Node ids the canvas should spotlight — driven by clicking a diagnostic (a dead transition, a
   * loop, a source place …). A separate channel from the editor's selection so it reads as "the
   * analysis points here", survives Simulate (where selection is off), and never edits the net.
   */
  highlight: string[];

  toggle: () => void;
  close: () => void;
  /** Set the panel width live (transient — does not persist; the drag calls {@link commitWidth} at the end). */
  setWidth: (width: number) => void;
  /** Persist the current width once, at the end of a resize drag. */
  commitWidth: () => void;
  setActiveTab: (tab: AnalyticsTab) => void;
  /** Refresh the instant algebraic slice from the current net; behavioural verdicts reset to pending. */
  analyze: () => void;
  /** Run the on-demand behavioural reachability pass for the current net and clear the stale flag. */
  reanalyze: () => void;
  /** Spotlight these nodes on the canvas; passing the already-lit set toggles the highlight off. */
  highlightNodes: (ids: string[]) => void;
}

const STORAGE_KEY = "petrinet.analytics.v1";
/** The left sidebar (`w-52`) is the hard floor: the panel may occlude the canvas, never it. */
const SIDEBAR_PX = 208;
const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 360;

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
  const fallback: Persisted = { open: false, width: DEFAULT_WIDTH, activeTab: "invariants" };
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw) as Partial<Persisted>;
    return {
      open: data.open ?? false,
      width: clampWidth(data.width ?? DEFAULT_WIDTH),
      activeTab: data.activeTab ?? "invariants",
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
    highlight: [],

    toggle: () => {
      const open = !get().open;
      set({ open, result: open ? algebraicResult() : get().result, stale: false, highlight: [] });
      persist(get());
    },
    close: () => {
      set({ open: false, highlight: [] });
      persist(get());
    },
    // Persisting on every pointermove would thrash localStorage during a drag; commitWidth saves once.
    setWidth: (width) => set({ width: clampWidth(width) }),
    commitWidth: () => persist(get()),
    setActiveTab: (activeTab) => {
      // A highlight belongs to the diagnostic that lit it; leaving its tab drops it.
      set({ activeTab, highlight: [] });
      persist(get());
    },
    highlightNodes: (ids) => {
      const current = get().highlight;
      const same = ids.length === current.length && ids.every((id, i) => id === current[i]);
      set({ highlight: same ? [] : ids });
    },
    analyze: () => set({ result: algebraicResult(), stale: false }),
    reanalyze: () => {
      // Synchronous in v1 (cap-bounded); `running` brackets the call for the Web-Worker upgrade
      // (§9) that will make it async — both sets land before React repaints today, so no flicker.
      set({ running: true });
      // The live `result` already holds this net's algebraic slice (the subscription keeps it
      // current), so thread it straight in — only the reachability-derived fields recompute.
      const algebraic = get().result ?? algebraicResult();
      set({
        result: NetAnalysis.behavioral(useNetStore.getState().net, algebraic),
        stale: false,
        running: false,
      });
    },
  };
});

// Keep the instant algebraic slice live while the panel is open, and flag the behavioural verdicts
// stale so the Re-analyze button signals there is fresh work to do. The net reference only changes
// in Build (Simulate edits a separate working copy), so results never go stale in Simulate.
//
// A position/label/rotation nudge mints a new net reference but cannot change any verdict, so it is
// filtered out by comparing structural signatures — otherwise dragging a node would discard valid
// behavioural results and force an expensive re-run.
useNetStore.subscribe((state, prev) => {
  if (state.net === prev.net) return;
  if (!useAnalyticsStore.getState().open) return;
  if (NetAnalysis.signature(state.net) === NetAnalysis.signature(prev.net)) return;
  // A structural edit can delete a highlighted node or invalidate the diagnostic that lit it, so
  // drop the highlight along with refreshing the algebraic slice. A cosmetic nudge (same signature)
  // is filtered above, so the spotlight follows a dragged/renamed node unchanged.
  useAnalyticsStore.setState({ result: algebraicResult(), stale: true, highlight: [] });
});
