import { create } from "zustand";
import { PetriNetEngine } from "@/domain/engine";
import { type History, SimHistory } from "@/domain/simHistory";
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
const EMPTY_HISTORY: History = { m0: {}, steps: [], cursor: -1 };

/** Auto-run speeds, in transitions fired per second; `DEFAULT_SPEED` is the initial selection. */
export const AUTO_RUN_SPEEDS = [1, 2, 5, 10] as const;
const DEFAULT_SPEED = 2;

export interface SimState {
  /** Working marking, advanced by firing; distinct from the persisted M0. */
  marking: Marking;
  /** Ids of transitions enabled under the current `marking`. */
  enabled: Set<string>;
  /** Firing log with a scrub cursor; in-memory only, reset on `start`/`reset`. */
  history: History;
  /** Auto-run is firing on a timer; the transport's interval hook starts/stops on this flag. */
  playing: boolean;
  /** Auto-run rate in transitions per second (one of {@link AUTO_RUN_SPEEDS}). */
  speed: number;
  /** Engine bound to the net captured at `start`; `null` outside Simulate. */
  _engine: PetriNetEngine | null;
  /** Snapshot of M0 taken at `start`, restored by `reset`. */
  _m0: Marking;

  /** Enter Simulate: bind the engine, snapshot M0, compute the enabled set, start the history. */
  start: (net: PetriNet) => void;
  /** Fire an enabled transition, advancing the marking and recording a history step; ignores disabled/unknown ids. */
  fire: (id: string) => void;
  /**
   * Fire one auto-run step: pick a uniformly-random enabled transition (the v1 conflict policy) and
   * fire it. With nothing enabled the run has reached a dead marking, so it stops (clears `playing`).
   */
  step: () => void;
  /** Begin auto-running (no-op at a dead marking, where there is nothing to fire). */
  play: () => void;
  /** Pause auto-running. */
  pause: () => void;
  /** Set the auto-run rate (transitions per second). */
  setSpeed: (speed: number) => void;
  /**
   * Adjust a place's tokens by `delta` (clamped at 0) and recompute enabledness. A manual marking
   * edit, not a firing — it is not recorded in `history` (which logs only fired transitions).
   */
  spawnToken: (placeId: string, delta: number) => void;
  /** Scrub the history to `cursor` (−1 = M0), restoring the marking recorded after that step. */
  goto: (cursor: number) => void;
  /** Restore the marking to the captured M0 and clear the history. */
  reset: () => void;
  /** Leave Simulate: drop the working copy. */
  stop: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
  marking: {},
  enabled: new Set<string>(),
  history: EMPTY_HISTORY,
  playing: false,
  speed: DEFAULT_SPEED,
  _engine: null,
  _m0: {},

  start: (net) => {
    const engine = new PetriNetEngine(net);
    const m0 = PetriNetEngine.initialMarking(net);
    set({
      _engine: engine,
      _m0: m0,
      marking: m0,
      enabled: new Set(engine.enabledTransitions(m0)),
      history: SimHistory.init(m0),
      playing: false,
    });
  },

  fire: (id) => {
    const { _engine, marking, enabled, history } = get();
    if (!_engine || !enabled.has(id)) return;
    const next = _engine.fire(id, marking);
    set({
      marking: next,
      enabled: new Set(_engine.enabledTransitions(next)),
      history: SimHistory.record(history, id, next),
    });
  },

  step: () => {
    const { enabled, fire } = get();
    if (enabled.size === 0) {
      set({ playing: false });
      return;
    }
    const ids = [...enabled];
    fire(ids[Math.floor(Math.random() * ids.length)]);
  },

  play: () => {
    if (get().enabled.size > 0) set({ playing: true });
  },
  pause: () => set({ playing: false }),
  setSpeed: (speed) => set({ speed }),

  spawnToken: (placeId, delta) => {
    const { _engine, marking } = get();
    if (!_engine) return;
    const next: Marking = { ...marking, [placeId]: Math.max(0, (marking[placeId] ?? 0) + delta) };
    set({ marking: next, enabled: new Set(_engine.enabledTransitions(next)) });
  },

  goto: (cursor) => {
    const { _engine, history } = get();
    if (!_engine) return;
    const next = SimHistory.goto(history, cursor);
    const marking = SimHistory.markingAt(next, next.cursor);
    set({ history: next, marking, enabled: new Set(_engine.enabledTransitions(marking)) });
  },

  reset: () => {
    const { _engine, _m0 } = get();
    if (!_engine) return;
    set({
      marking: _m0,
      enabled: new Set(_engine.enabledTransitions(_m0)),
      history: SimHistory.init(_m0),
      playing: false,
    });
  },

  stop: () =>
    set({
      _engine: null,
      _m0: {},
      marking: {},
      enabled: new Set<string>(),
      history: EMPTY_HISTORY,
      playing: false,
    }),
}));
