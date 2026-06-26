import { create } from "zustand";
import type { Vec2 } from "@/domain/types";

/**
 * An in-progress click-to-draw arc. `source` is the origin node; `bends` are the committed
 * interior points (flow-space, in order, endpoints excluded); `cursor` is the live pointer;
 * `hoverTarget` is the node currently under the cursor (drives the valid/invalid ring).
 */
export interface ArcDraft {
  source: string;
  bends: Vec2[];
  cursor: Vec2;
  hoverTarget: string | null;
}

/**
 * A mutually-exclusive Build interaction tool. `idle` is the default (select / move / draw an arc);
 * `place` and `transition` are click-to-place tools that drop that kind of node where the ghost
 * sits; `select` is the marquee tool (behaviour wired in Phase B4). Only one is ever active.
 */
export type BuildTool = "idle" | "place" | "transition" | "select";

const SNAP_STORAGE_KEY = "petrinet:snap-to-grid";

/** Snap-to-grid is ON by default; only an explicit opt-out persists as "false". Guards the
 *  non-browser case (the store is imported by node-env unit tests), as the autosave layer does. */
function loadSnap(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(SNAP_STORAGE_KEY) !== "false";
}

/**
 * Transient Build-mode interaction state, kept out of the domain net (and so out of undo/redo).
 * It owns the arc-draw state machine and the active Palette {@link BuildTool}; the two are mutually
 * exclusive (activating a tool cancels any in-progress draft). The {@link ArcDraft} is advanced by
 * the canvas draw layer and consumed to create the real arc via the net store on finish.
 */
export interface BuildState {
  draft: ArcDraft | null;
  tool: BuildTool;
  /** Whether node centers snap to the 24px grid on placement and drag (persisted). */
  snap: boolean;
  /** Begin drawing an arc from `source`, with the cursor at `at`. */
  startArc: (source: string, at: Vec2) => void;
  /** Track the live cursor and the node (if any) under it. */
  moveDraft: (cursor: Vec2, hoverTarget: string | null) => void;
  /** Commit a bend at `at` and continue the line from there. */
  addBend: (at: Vec2) => void;
  /** Discard the in-progress arc (finish, Esc, or right-click). */
  cancelArc: () => void;
  /** Activate `tool`, or fall back to `idle` if it is already active (clicking the same Palette item). */
  toggleTool: (tool: BuildTool) => void;
  /** Set the active tool directly (e.g. `idle` to exit a placing tool on Esc / right-click). */
  setTool: (tool: BuildTool) => void;
  /** Flip snap-to-grid and persist the new state. */
  toggleSnap: () => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  draft: null,
  tool: "idle",
  snap: loadSnap(),
  startArc: (source, at) => set({ draft: { source, bends: [], cursor: at, hoverTarget: null } }),
  moveDraft: (cursor, hoverTarget) =>
    set((s) => (s.draft ? { draft: { ...s.draft, cursor, hoverTarget } } : s)),
  addBend: (at) =>
    set((s) =>
      s.draft ? { draft: { ...s.draft, bends: [...s.draft.bends, at], cursor: at } } : s,
    ),
  cancelArc: () => set({ draft: null }),
  // Switching tools always clears any in-progress arc: the two interactions are exclusive.
  toggleTool: (tool) => set((s) => ({ tool: s.tool === tool ? "idle" : tool, draft: null })),
  setTool: (tool) => set({ tool, draft: null }),
  toggleSnap: () =>
    set((s) => {
      const snap = !s.snap;
      localStorage.setItem(SNAP_STORAGE_KEY, String(snap));
      return { snap };
    }),
}));
