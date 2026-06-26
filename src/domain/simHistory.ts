import type { Marking } from "@/domain/types";

/** One recorded firing: the transition that fired and the marking it produced. */
export interface HistoryStep {
  firedId: string;
  marking: Marking;
}

/**
 * A linear simulation history with a scrub cursor. `m0` is the "Initial (M0)" base
 * (`cursor === -1`); `steps[i]` is the marking after the (i+1)-th recorded firing
 * (`cursor === i`). In-memory only — the firing {@link PetriNetEngine} stays pure and
 * unaware of it; the live working marking is kept in sync by the sim store.
 */
export interface History {
  m0: Marking;
  steps: HistoryStep[];
  cursor: number;
}

/**
 * Pure reducer over a {@link History}. Recording from a rewound cursor branches: the dimmed
 * future is discarded before the new step is appended (classic time-travel, not a tree).
 */
export class SimHistory {
  /** Fresh history at M0 — no steps, cursor before the first step. */
  static init(m0: Marking): History {
    return { m0, steps: [], cursor: -1 };
  }

  /** Append a firing after the cursor (discarding any rewound future) and land the cursor on it. */
  static record(history: History, firedId: string, marking: Marking): History {
    const kept = history.steps.slice(0, history.cursor + 1);
    return { m0: history.m0, steps: [...kept, { firedId, marking }], cursor: kept.length };
  }

  /** Marking at `cursor` (−1 → M0); clamps out-of-range to the nearest valid state. */
  static markingAt(history: History, cursor: number): Marking {
    if (cursor < 0) return history.m0;
    const i = Math.min(cursor, history.steps.length - 1);
    return i < 0 ? history.m0 : history.steps[i].marking;
  }

  /** Move the cursor (clamped to [−1, last step]); steps are untouched. */
  static goto(history: History, cursor: number): History {
    return { ...history, cursor: Math.max(-1, Math.min(cursor, history.steps.length - 1)) };
  }
}
