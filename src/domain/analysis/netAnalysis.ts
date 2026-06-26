import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import { Invariants } from "@/domain/analysis/invariants";
import type {
  AnalysisResult,
  Boundedness,
  Diagnostics,
  InvariantSet,
  PropertyResult,
} from "@/domain/analysis/types";
import type { PetriNet } from "@/domain/types";

/** Shown for behavioural verdicts until the reachability pass (M3) is wired in. */
const BEHAVIOURAL_PENDING = "Requires the reachability pass.";

/**
 * The single entry point the UI calls to analyse a net at its initial marking M0. Pure and
 * framework-free, mirroring {@link PetriNetEngine}.
 *
 * This milestone produces the **algebraic slice** only — invariants, coverage, conservativeness
 * and structural boundedness, all decided from the {@link IncidenceMatrix} with no state search.
 * The behavioural verdicts (live / reversible / deadlock-free / exact bound) stay `indeterminate`
 * until {@link ReachabilityGraph} lands; the full {@link AnalysisResult} contract is honoured now
 * so the UI and store never change shape when it does.
 */
export class NetAnalysis {
  static analyze(net: PetriNet): AnalysisResult {
    const matrix = new IncidenceMatrix(net);
    const place = Invariants.placeInvariants(matrix);
    const transition = Invariants.transitionInvariants(matrix);
    const placesCovered = Invariants.covers(place, matrix.places);
    const transitionsCovered = Invariants.covers(transition, matrix.transitions);

    const invariants: InvariantSet = {
      place,
      transition,
      placesCovered,
      transitionsCovered,
      truncated: false,
    };

    // A P-invariant covering every place ⇒ bounded for any marking, with no state search; the
    // exact bound k (and hence safeness) still needs the reachability pass.
    const boundedness: Boundedness = {
      bounded: placesCovered ? "yes" : "indeterminate",
      safe: "indeterminate",
      bound: null,
      source: placesCovered ? "structural" : "none",
    };

    const strictlyConservative = NetAnalysis._strictlyConservative(matrix.c);
    const conservative = NetAnalysis._conservative(placesCovered, strictlyConservative);
    const pending: PropertyResult = { verdict: "indeterminate", detail: BEHAVIOURAL_PENDING };

    return {
      boundedness,
      conservative,
      strictlyConservative,
      live: pending,
      quasiLive: pending,
      reversible: pending,
      deadlockFree: pending,
      invariants,
      diagnostics: NetAnalysis._emptyDiagnostics(),
      stateSpaceExceeded: false,
      exploredStates: 0,
    };
  }

  /**
   * Conservative ⟺ a positive P-invariant exists ⟺ every place is covered by some minimal
   * P-semiflow (their sum is then a full-support semiflow). Fully algebraic, so a definite yes/no.
   */
  private static _conservative(placesCovered: boolean, strict: boolean): PropertyResult {
    if (!placesCovered) {
      return {
        verdict: "no",
        detail:
          "No positive token weighting is conserved — some place lies outside every invariant.",
      };
    }
    return {
      verdict: "yes",
      detail: strict
        ? "Strictly conservative — the total token count never changes."
        : "A positive token weighting is conserved by every firing.",
    };
  }

  /** All-ones is a P-invariant ⟺ every transition column of `C` sums to zero. */
  private static _strictlyConservative(c: number[][]): boolean {
    if (c.length === 0) return false;
    const cols = c[0].length;
    for (let t = 0; t < cols; t++) {
      let sum = 0;
      for (const row of c) sum += row[t];
      if (sum !== 0) return false;
    }
    return true;
  }

  /** Behavioural/structural diagnostics are filled by the reachability pass (M4); empty for now. */
  private static _emptyDiagnostics(): Diagnostics {
    return {
      deadTransitions: [],
      deadlocks: [],
      cyclicComponents: [],
      acyclic: false,
      sourcePlaces: [],
      sinkPlaces: [],
      sourceTransitions: [],
      sinkTransitions: [],
      isolated: [],
      connected: false,
    };
  }
}
