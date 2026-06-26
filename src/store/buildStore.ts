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
 * Transient Build-mode interaction state, kept out of the domain net (and so out of undo/redo).
 * For now it owns only the arc-draw state machine; Phase B grows it with palette placing tools,
 * snap, and marquee selection. The {@link ArcDraft} is advanced by the canvas draw layer and
 * consumed to create the real arc via the net store on finish.
 */
export interface BuildState {
  draft: ArcDraft | null;
  /** Begin drawing an arc from `source`, with the cursor at `at`. */
  startArc: (source: string, at: Vec2) => void;
  /** Track the live cursor and the node (if any) under it. */
  moveDraft: (cursor: Vec2, hoverTarget: string | null) => void;
  /** Commit a bend at `at` and continue the line from there. */
  addBend: (at: Vec2) => void;
  /** Discard the in-progress arc (finish, Esc, or right-click). */
  cancelArc: () => void;
}

export const useBuildStore = create<BuildState>((set) => ({
  draft: null,
  startArc: (source, at) => set({ draft: { source, bends: [], cursor: at, hoverTarget: null } }),
  moveDraft: (cursor, hoverTarget) =>
    set((s) => (s.draft ? { draft: { ...s.draft, cursor, hoverTarget } } : s)),
  addBend: (at) =>
    set((s) =>
      s.draft ? { draft: { ...s.draft, bends: [...s.draft.bends, at], cursor: at } } : s,
    ),
  cancelArc: () => set({ draft: null }),
}));
