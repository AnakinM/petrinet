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
 */
export interface AnalyticsState {
  open: boolean;
  width: number;
  activeTab: AnalyticsTab;
  /** Last analysis (algebraic slice in M2); recomputed from M0 while the panel is open. */
  result: AnalysisResult | null;
  /** Behavioural verdicts are out of date after an edit. Wired with the reachability pass (M4). */
  stale: boolean;
  /** A behavioural pass is in flight. Wired with the reachability pass (M4). */
  running: boolean;

  toggle: () => void;
  close: () => void;
  setWidth: (width: number) => void;
  setActiveTab: (tab: AnalyticsTab) => void;
  /** Recompute the analysis from the current net (M0). */
  analyze: () => void;
}

const STORAGE_KEY = "petrinet.analytics.v1";
/** The left sidebar (`w-64`) is the hard floor: the panel may occlude the canvas, never it. */
const SIDEBAR_PX = 256;
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

function currentResult(): AnalysisResult {
  return NetAnalysis.analyze(useNetStore.getState().net);
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => {
  const persisted = loadPersisted();
  return {
    ...persisted,
    result: persisted.open ? currentResult() : null,
    stale: false,
    running: false,

    toggle: () => {
      const open = !get().open;
      set({ open, result: open ? currentResult() : get().result });
      persist(get());
    },
    close: () => {
      set({ open: false });
      persist(get());
    },
    setWidth: (width) => {
      set({ width: clampWidth(width) });
      persist(get());
    },
    setActiveTab: (activeTab) => {
      set({ activeTab });
      persist(get());
    },
    analyze: () => set({ result: currentResult(), stale: false }),
  };
});

// Keep the (instant) algebraic result live while the panel is open, mirroring the net store. The
// heavier behavioural pass will move to an on-demand "Re-analyze" with a stale badge when it lands.
useNetStore.subscribe((state, prev) => {
  if (state.net === prev.net) return;
  if (useAnalyticsStore.getState().open) useAnalyticsStore.getState().analyze();
});
