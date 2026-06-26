import { type TemporalState, temporal } from "zundo";
import { create, useStore } from "zustand";
import type { ArcEnd } from "@/domain/netOps";
import { NetOps } from "@/domain/netOps";
import type { PetriNet, Vec2 } from "@/domain/types";
import { SAMPLE_NET } from "@/flow/sampleNet";
import { Autosave } from "@/store/autosave";

/** Editor mode. Build allows structural editing; Simulate (M5) locks it. */
export type Mode = "build" | "simulate";

/** Pan/zoom of the canvas. `null` until first positioned, so the canvas knows to fit-view. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Current canvas selection, mirrored from React Flow so panels can read it. */
export interface Selection {
  nodes: string[];
  edges: string[];
}

const EMPTY_SELECTION: Selection = { nodes: [], edges: [] };

export interface NetState {
  /** The single source of truth (M0). The only slice tracked by undo/redo. */
  net: PetriNet;
  selection: Selection;
  mode: Mode;
  viewport: Viewport | null;

  // --- structural edits (each is one undo step) ---
  /** Replace the whole net (import / new), clearing selection. */
  setNet: (net: PetriNet) => void;
  addPlace: (position: Vec2) => void;
  addTransition: (position: Vec2) => void;
  /** Commit a finished drag of one or more nodes (coalesced into a single history entry). */
  moveNodes: (moves: { id: string; position: Vec2 }[]) => void;
  /** Create an arc `source`→`target` with optional interior bends (from click-to-draw). */
  connect: (source: string, target: string, bends?: Vec2[]) => void;
  rename: (id: string, name: string) => void;
  setTokens: (placeId: string, tokens: number) => void;
  setMultiplicity: (arcId: string, multiplicity: number) => void;
  rotateTransition: (id: string, deg: number) => void;
  /** Commit a finished arc-waypoint drag (interior point). */
  moveWaypoint: (arcId: string, index: number, position: Vec2) => void;
  insertWaypoint: (arcId: string, index: number, position: Vec2) => void;
  removeWaypoint: (arcId: string, index: number) => void;
  /** Commit a finished arc-endpoint drag (re-clipped to the border when magnetic). */
  moveEndpoint: (arcId: string, end: ArcEnd, target: Vec2) => void;
  /** Remove the given ids (nodes drop their incident arcs); clears selection. */
  remove: (ids: string[]) => void;
  removeSelected: () => void;

  // --- transient UI state (never tracked by undo/redo) ---
  select: (selection: Selection) => void;
  setMode: (mode: Mode) => void;
  setViewport: (viewport: Viewport) => void;
}

/** Tracked slice — only `net` is undoable; selection / mode / viewport are not. */
type TrackedState = { net: PetriNet };

const restored = Autosave.load();

export const useNetStore = create<NetState>()(
  temporal(
    (set) => ({
      net: restored?.net ?? SAMPLE_NET,
      selection: EMPTY_SELECTION,
      mode: "build",
      viewport: restored?.viewport ?? null,

      setNet: (net) => set({ net, selection: EMPTY_SELECTION }),
      addPlace: (position) => set((s) => ({ net: NetOps.addPlace(s.net, position) })),
      addTransition: (position) => set((s) => ({ net: NetOps.addTransition(s.net, position) })),
      moveNodes: (moves) =>
        set((s) => ({
          net: moves.reduce((net, m) => NetOps.moveNode(net, m.id, m.position), s.net),
        })),
      connect: (source, target, bends) =>
        set((s) => ({ net: NetOps.connect(s.net, source, target, bends) })),
      rename: (id, name) => set((s) => ({ net: NetOps.rename(s.net, id, name) })),
      setTokens: (placeId, tokens) =>
        set((s) => ({ net: NetOps.setTokens(s.net, placeId, tokens) })),
      setMultiplicity: (arcId, multiplicity) =>
        set((s) => ({ net: NetOps.setMultiplicity(s.net, arcId, multiplicity) })),
      rotateTransition: (id, deg) => set((s) => ({ net: NetOps.rotateTransition(s.net, id, deg) })),
      moveWaypoint: (arcId, index, position) =>
        set((s) => ({ net: NetOps.moveWaypoint(s.net, arcId, index, position) })),
      insertWaypoint: (arcId, index, position) =>
        set((s) => ({ net: NetOps.insertWaypoint(s.net, arcId, index, position) })),
      removeWaypoint: (arcId, index) =>
        set((s) => ({ net: NetOps.removeWaypoint(s.net, arcId, index) })),
      moveEndpoint: (arcId, end, target) =>
        set((s) => ({ net: NetOps.moveEndpoint(s.net, arcId, end, target) })),
      remove: (ids) =>
        set((s) => ({
          net: ids.reduce((net, id) => NetOps.remove(net, id), s.net),
          selection: EMPTY_SELECTION,
        })),
      removeSelected: () =>
        set((s) => ({
          net: [...s.selection.nodes, ...s.selection.edges].reduce(
            (net, id) => NetOps.remove(net, id),
            s.net,
          ),
          selection: EMPTY_SELECTION,
        })),

      select: (selection) => set({ selection }),
      setMode: (mode) => set({ mode }),
      setViewport: (viewport) => set({ viewport }),
    }),
    {
      // Track only the net; a change is recorded only when its reference actually changes
      // (NetOps returns the same net for a no-op), so selection/viewport edits never push history.
      partialize: (state): TrackedState => ({ net: state.net }),
      equality: (a, b) => a.net === b.net,
      limit: 100,
    },
  ),
);

/** Subscribe React components to undo/redo history (e.g. button enablement). */
export function useTemporal<T>(selector: (state: TemporalState<TrackedState>) => T): T {
  return useStore(useNetStore.temporal, selector);
}

/** Imperative undo/redo (zundo restores the tracked `net` without recording the restore). */
export const netHistory = {
  undo: (): void => useNetStore.temporal.getState().undo(),
  redo: (): void => useNetStore.temporal.getState().redo(),
};

// Begin debounced localStorage autosave of { net, viewport }. Module-scope so it is always on.
Autosave.attach(useNetStore);
