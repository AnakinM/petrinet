// Plain-data result shapes for the analytics module — no methods, no framework imports.
// The full contract is defined up front (spec §6); the algebraic milestone fills the
// invariants/conservative/boundedness slices, the behavioural pass fills the rest.

import type { Marking } from "@/domain/types";

/** Three-valued verdict, so the UI never lies about a net too large to settle. */
export type Verdict = "yes" | "no" | "indeterminate";

/** A verdict plus a one-line human explanation/witness. */
export interface PropertyResult {
  verdict: Verdict;
  detail: string;
}

/**
 * A place- or transition-invariant: a minimal semipositive semiflow, listed as the weights of
 * its support only (zero weights omitted, all positive integers). Keyed by element **id**
 * (stable across the domain, like {@link Marking}); the UI resolves ids to display names.
 */
export interface Invariant {
  weights: Record<string, number>;
}

/** Boundedness/safeness, with how it was decided and the bound when known. */
export interface Boundedness {
  bounded: Verdict;
  safe: Verdict;
  bound: number | null;
  source: "structural" | "reachability" | "none";
}

/** P/T-invariants and the coverage flags derived from their supports. */
export interface InvariantSet {
  place: Invariant[];
  transition: Invariant[];
  /** Every place lies in some P-invariant's support ⇒ structurally bounded & conservative. */
  placesCovered: boolean;
  /** Every transition lies in some T-invariant's support ⇒ consistent. */
  transitionsCovered: boolean;
  /** The minimal-invariant set was larger than the display cap. */
  truncated: boolean;
}

/** A reachable dead marking plus a firing path (transition ids) that reaches it from M0. */
export interface Deadlock {
  marking: Marking;
  path: string[];
}

/** Structural & behavioural diagnostics for the Structure tab. */
export interface Diagnostics {
  deadTransitions: string[];
  deadlocks: Deadlock[];
  cyclicComponents: string[][];
  acyclic: boolean;
  sourcePlaces: string[];
  sinkPlaces: string[];
  sourceTransitions: string[];
  sinkTransitions: string[];
  isolated: string[];
  connected: boolean;
}

/** The complete analysis of a net at its initial marking M0 — the only thing the UI consumes. */
export interface AnalysisResult {
  boundedness: Boundedness;
  conservative: PropertyResult;
  strictlyConservative: boolean;
  live: PropertyResult;
  quasiLive: PropertyResult;
  reversible: PropertyResult;
  deadlockFree: PropertyResult;
  invariants: InvariantSet;
  diagnostics: Diagnostics;
  /** The reachability graph hit STATE_CAP, so behavioural verdicts read `indeterminate`. */
  stateSpaceExceeded: boolean;
  exploredStates: number;
}
