import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import { Invariants } from "@/domain/analysis/invariants";
import { NetStructure } from "@/domain/analysis/netStructure";
import { ReachabilityGraph } from "@/domain/analysis/reachabilityGraph";
import type {
  AnalysisResult,
  Boundedness,
  InvariantSet,
  PropertyResult,
  Verdict,
} from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { Marking, PetriNet } from "@/domain/types";

/** Behavioural verdict shown until the on-demand reachability pass has run for the current net. */
export const NOT_COMPUTED = "Not yet computed. Run Re-analyze.";
/** The state cap rendered for humans (`"10,000"`), derived from the single source of truth. */
export const STATE_CAP_LABEL = ReachabilityGraph.STATE_CAP.toLocaleString("en-US");
/** Why a behavioural verdict is indeterminate after the reachability pass overran the cap. */
export const STATE_CAP_EXCEEDED = `The state space exceeded the ${STATE_CAP_LABEL}-marking cap.`;

/** Optional second argument to {@link NetAnalysis.analyze}. */
interface AnalyzeOptions {
  /** Run the reachability pass for the behavioural verdicts; omit/false for the algebraic slice only. */
  behavioral?: boolean;
  /** Reachability state cap override — a test seam; production uses {@link ReachabilityGraph.STATE_CAP}. */
  cap?: number;
  /** Invariant generator cap override — a test seam; production uses {@link Invariants.MAX_GENERATORS}. */
  invariantCap?: number;
}

/**
 * The single entry point the UI calls to analyse a net at its initial marking M0. Pure and
 * framework-free, mirroring {@link PetriNetEngine}.
 *
 * Two layers, matching the spec:
 *   - **Algebraic** (always): invariants, coverage, conservativeness and structural boundedness
 *     from the {@link IncidenceMatrix}, plus the structural net-graph {@link NetStructure}
 *     diagnostics — all instant, with no state search.
 *   - **Behavioural** (`behavioral: true`): one {@link ReachabilityGraph} pass settles live /
 *     reversible / deadlock-free / quasi-live, the exact bound and safeness, and the dead-transition
 *     and deadlock witnesses. Without it those verdicts stay `indeterminate`.
 *
 * The full {@link AnalysisResult} contract is honoured either way, so the UI and store never change
 * shape between the cheap live pass and the on-demand behavioural one.
 */
export class NetAnalysis {
  static analyze(net: PetriNet, opts?: AnalyzeOptions): AnalysisResult {
    const algebraic = NetAnalysis._algebraic(net, opts?.invariantCap);
    return opts?.behavioral ? NetAnalysis.behavioral(net, algebraic, opts.cap) : algebraic;
  }

  /**
   * The instant algebraic slice — invariants, conservativeness, structural boundedness and the
   * net-graph diagnostics — with every behavioural verdict left `indeterminate`. The store keeps
   * this live while the panel is open, then threads it straight into {@link behavioral} so the
   * on-demand reachability pass never recomputes any of it.
   */
  private static _algebraic(net: PetriNet, invariantCap?: number): AnalysisResult {
    const matrix = new IncidenceMatrix(net);
    const invariants = Invariants.invariantSet(matrix, invariantCap);
    const strictlyConservative = NetAnalysis._strictlyConservative(matrix.c);
    const pending: PropertyResult = { verdict: "indeterminate", detail: NOT_COMPUTED };
    return {
      boundedness: {
        bounded: invariants.placesCovered ? "yes" : "indeterminate",
        safe: "indeterminate",
        bound: null,
        source: invariants.placesCovered ? "structural" : "none",
      },
      conservative: NetAnalysis._conservative(invariants, strictlyConservative),
      strictlyConservative,
      live: pending,
      quasiLive: pending,
      reversible: pending,
      deadlockFree: pending,
      invariants,
      diagnostics: { ...NetStructure.analyze(net), deadTransitions: [], deadlocks: [] },
      stateSpaceExceeded: false,
      stateSpaceComplete: false,
      exploredStates: 0,
    };
  }

  /**
   * Augments a precomputed {@link _algebraic} slice with one {@link ReachabilityGraph} pass: the
   * behavioural verdicts (live / reversible / deadlock-free / quasi-live), the exact bound and
   * safeness, and the dead-transition / deadlock witnesses. The algebraic fields pass through
   * untouched, so Re-analyze reuses them rather than redoing the invariant and structural work.
   */
  static behavioral(
    net: PetriNet,
    algebraic: AnalysisResult,
    cap: number = ReachabilityGraph.STATE_CAP,
  ): AnalysisResult {
    const rg = new ReachabilityGraph(net, cap);
    return {
      ...algebraic,
      boundedness: NetAnalysis._boundedness(algebraic.invariants.placesCovered, rg),
      live: NetAnalysis._live(rg),
      quasiLive: NetAnalysis._quasiLive(rg, net),
      reversible: NetAnalysis._reversible(rg),
      deadlockFree: NetAnalysis._deadlockFree(rg, net),
      diagnostics: {
        ...algebraic.diagnostics,
        deadTransitions: rg.deadTransitions(),
        deadlocks: rg.deadlocks(),
      },
      stateSpaceExceeded: rg.exceeded,
      stateSpaceComplete: rg.complete,
      exploredStates: rg.states,
    };
  }

  /**
   * Is `target` reachable from M0? Builds the reachability graph and reports a three-valued verdict
   * with a one-line explanation: reachable, not reachable (only on a fully-built graph), or
   * indeterminate when the search was cut off by the state cap or by unboundedness.
   */
  static reachable(
    net: PetriNet,
    target: Marking,
    cap: number = ReachabilityGraph.STATE_CAP,
  ): { verdict: Verdict; detail: string } {
    const rg = new ReachabilityGraph(net, cap);
    const verdict = rg.queryReachable(target);
    if (verdict === "yes") {
      return { verdict, detail: "This marking is reachable from M0." };
    }
    if (verdict === "no") {
      const states = rg.states.toLocaleString("en-US");
      return {
        verdict,
        detail: `Not reachable: the complete reachability graph (${states} markings) does not contain it.`,
      };
    }
    return {
      verdict,
      detail: rg.unbounded
        ? "Unknown — the net is unbounded, so its reachable markings cannot be fully enumerated."
        : STATE_CAP_EXCEEDED,
    };
  }

  /**
   * A fingerprint of everything an analysis depends on — place ids & token counts, transition ids,
   * and arc topology with multiplicities. Excludes positions, labels, rotation and names (none
   * affect a verdict), so a layout nudge produces the same signature and need not invalidate results.
   *
   * JSON-encoded (not delimiter-joined) so it is injective: imported ids may contain any character,
   * and a structural change must never collide with an unrelated net's fingerprint string.
   */
  static signature(net: PetriNet): string {
    return JSON.stringify([
      net.places.map((p) => [p.id, p.tokens]),
      net.transitions.map((t) => t.id),
      net.arcs.map((a) => [a.source, a.target, a.multiplicity]),
    ]);
  }

  /**
   * A structural P-cover proves boundedness for any marking with no state search, so it wins the
   * `source` label; reachability still supplies the exact bound and safeness — which stay unknown
   * (`bound: null`, `safe: "indeterminate"`) if the pass hit the cap, even on a structurally
   * bounded net. Without a P-cover, boundedness itself is whatever reachability could settle.
   */
  private static _boundedness(placesCovered: boolean, rg: ReachabilityGraph): Boundedness {
    if (placesCovered) {
      return { bounded: "yes", safe: rg.isSafe(), bound: rg.bound(), source: "structural" };
    }
    return {
      bounded: rg.isBounded(),
      safe: rg.isSafe(),
      bound: rg.bound(),
      source: "reachability",
    };
  }

  private static _live(rg: ReachabilityGraph): PropertyResult {
    switch (rg.isLive()) {
      case "yes":
        return {
          verdict: "yes",
          detail: "Every transition can fire again from every reachable marking.",
        };
      case "no":
        return {
          verdict: "no",
          detail: "A transition can no longer fire once the net settles into a terminal cycle.",
        };
      default:
        return { verdict: "indeterminate", detail: NetAnalysis._whyIndeterminate(rg) };
    }
  }

  private static _reversible(rg: ReachabilityGraph): PropertyResult {
    switch (rg.isReversible()) {
      case "yes":
        return { verdict: "yes", detail: "M0 is reachable again from every reachable marking." };
      case "no":
        return { verdict: "no", detail: "Some reachable marking can never return to M0." };
      default:
        return { verdict: "indeterminate", detail: NetAnalysis._whyIndeterminate(rg) };
    }
  }

  private static _deadlockFree(rg: ReachabilityGraph, net: PetriNet): PropertyResult {
    switch (rg.isDeadlockFree()) {
      case "yes":
        return { verdict: "yes", detail: "No reachable marking is dead." };
      case "no": {
        const marked = NetNames.markedPlaces(rg.deadlocks()[0].marking, net.places);
        return marked.length > 0
          ? { verdict: "no", detail: "Reaches a dead marking:", items: marked }
          : { verdict: "no", detail: "Reaches a dead marking with every place empty." };
      }
      default:
        return { verdict: "indeterminate", detail: NetAnalysis._whyIndeterminate(rg) };
    }
  }

  private static _quasiLive(rg: ReachabilityGraph, net: PetriNet): PropertyResult {
    switch (rg.isQuasiLive()) {
      case "yes":
        return { verdict: "yes", detail: "Every transition can fire in some reachable marking." };
      case "no": {
        const name = NetNames.resolver(net.transitions);
        const names = rg.deadTransitions().map(name);
        return { verdict: "no", detail: `Never fires: ${names.join(", ")}.` };
      }
      default:
        return { verdict: "indeterminate", detail: NetAnalysis._whyIndeterminate(rg) };
    }
  }

  private static _whyIndeterminate(rg: ReachabilityGraph): string {
    if (rg.unbounded) return "The net is unbounded, so its reachability graph is infinite.";
    if (rg.exceeded) return STATE_CAP_EXCEEDED;
    return NOT_COMPUTED;
  }

  /**
   * Conservative ⟺ a positive P-invariant exists ⟺ every place is covered by some minimal
   * P-semiflow (their sum is then a full-support semiflow). Fully algebraic, so a definite yes/no —
   * unless the P-semiflow enumeration truncated, in which case place coverage is unknown and the
   * verdict degrades to indeterminate rather than claim a false "no" (a T-overflow is irrelevant here).
   */
  private static _conservative(invariants: InvariantSet, strict: boolean): PropertyResult {
    if (invariants.placeTruncated) {
      return {
        verdict: "indeterminate",
        detail: "Too many place invariants to enumerate within the safety cap.",
      };
    }
    if (!invariants.placesCovered) {
      return {
        verdict: "no",
        detail:
          "No positive token weighting is conserved, because some place lies outside every invariant.",
      };
    }
    return {
      verdict: "yes",
      detail: strict
        ? "The total token count never changes, so the net is strictly conservative."
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
}
