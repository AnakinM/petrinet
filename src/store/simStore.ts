import { create } from "zustand";
import { PetriNetEngine } from "@/domain/engine";
import type { Marking, PetriNet } from "@/domain/types";

/**
 * Live simulation state — a working copy that never persists.
 *
 * Deliberately separate from the net store (and its zundo history): firing, token
 * spawning, and reset advance a private {@link Marking} via the pure
 * {@link PetriNetEngine} without ever touching the net. M0 lives in the net
 * (`place.tokens`); this store snapshots it on `start` and restores it on `reset`,
 * so export still serializes M0 only.
 *
 * The engine is bound to the net captured at `start`. Structural editing is locked
 * in Simulate, so that net stays frozen for the session — no re-binding needed.
 */
export interface SimState {
  /** Working marking, advanced by firing; distinct from the persisted M0. */
  marking: Marking;
  /** Ids of transitions enabled under the current `marking`. */
  enabled: Set<string>;
  /** Engine bound to the net captured at `start`; `null` outside Simulate. */
  _engine: PetriNetEngine | null;
  /** Snapshot of M0 taken at `start`, restored by `reset`. */
  _m0: Marking;

  /** Enter Simulate: bind the engine, snapshot M0, compute the enabled set. */
  start: (net: PetriNet) => void;
  /** Fire an enabled transition, advancing the marking; ignores disabled/unknown ids. */
  fire: (id: string) => void;
  /** Adjust a place's tokens by `delta` (clamped at 0) and recompute enabledness. */
  spawnToken: (placeId: string, delta: number) => void;
  /** Restore the marking to the captured M0. */
  reset: () => void;
  /** Leave Simulate: drop the working copy. */
  stop: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  marking: {},
  enabled: new Set<string>(),
  _engine: null,
  _m0: {},

  start: (net) => {
    const engine = new PetriNetEngine(net);
    const m0 = PetriNetEngine.initialMarking(net);
    set({ _engine: engine, _m0: m0, marking: m0, enabled: new Set(engine.enabledTransitions(m0)) });
  },

  fire: (id) => {
    const { _engine, marking, enabled } = get();
    if (!_engine || !enabled.has(id)) return;
    const next = _engine.fire(id, marking);
    set({ marking: next, enabled: new Set(_engine.enabledTransitions(next)) });
  },

  spawnToken: (placeId, delta) => {
    const { _engine, marking } = get();
    if (!_engine) return;
    const next: Marking = { ...marking, [placeId]: Math.max(0, (marking[placeId] ?? 0) + delta) };
    set({ marking: next, enabled: new Set(_engine.enabledTransitions(next)) });
  },

  reset: () => {
    const { _engine, _m0 } = get();
    if (!_engine) return;
    set({ marking: _m0, enabled: new Set(_engine.enabledTransitions(_m0)) });
  },

  stop: () => set({ _engine: null, _m0: {}, marking: {}, enabled: new Set<string>() }),
}));
