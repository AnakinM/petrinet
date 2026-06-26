import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import { Invariants } from "@/domain/analysis/invariants";
import { NetStructure } from "@/domain/analysis/netStructure";
import { ReachabilityGraph } from "@/domain/analysis/reachabilityGraph";
import type {
  AnalysisResult,
  Boundedness,
  InvariantSet,
  PropertyResult,
} from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { Marking, PetriNet } from "@/domain/types";

/** Behavioural verdict shown until the on-demand reachability pass has run for the current net. */
export const NOT_COMPUTED = "Not yet computed — run Re-analyze.";
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

    const strictlyConservative = NetAnalysis._strictlyConservative(matrix.c);
    const conservative = NetAnalysis._conservative(placesCovered, strictlyConservative);
    const structure = NetStructure.analyze(net);

    if (!opts?.behavioral) {
      const pending: PropertyResult = { verdict: "indeterminate", detail: NOT_COMPUTED };
      return {
        boundedness: {
          bounded: placesCovered ? "yes" : "indeterminate",
          safe: "indeterminate",
          bound: null,
          source: placesCovered ? "structural" : "none",
        },
        conservative,
        strictlyConservative,
        live: pending,
        quasiLive: pending,
        reversible: pending,
        deadlockFree: pending,
        invariants,
        diagnostics: { ...structure, deadTransitions: [], deadlocks: [] },
        stateSpaceExceeded: false,
        stateSpaceComplete: false,
        exploredStates: 0,
      };
    }

    const rg = new ReachabilityGraph(net, opts.cap ?? ReachabilityGraph.STATE_CAP);
    return {
      boundedness: NetAnalysis._boundedness(placesCovered, rg),
      conservative,
      strictlyConservative,
      live: NetAnalysis._live(rg),
      quasiLive: NetAnalysis._quasiLive(rg, net),
      reversible: NetAnalysis._reversible(rg),
      deadlockFree: NetAnalysis._deadlockFree(rg, net),
      invariants,
      diagnostics: {
        ...structure,
        deadTransitions: rg.deadTransitions(),
        deadlocks: rg.deadlocks(),
      },
      stateSpaceExceeded: rg.exceeded,
      stateSpaceComplete: rg.complete,
      exploredStates: rg.states,
    };
  }

  /**
   * A cheap fingerprint of everything an analysis depends on — place ids & token counts, transition
   * ids, and arc topology with multiplicities. Excludes positions, labels, rotation and names (none
   * affect a verdict), so a layout nudge produces the same signature and need not invalidate results.
   */
  static signature(net: PetriNet): string {
    const places = net.places.map((p) => `${p.id}:${p.tokens}`).join(",");
    const transitions = net.transitions.map((t) => t.id).join(",");
    const arcs = net.arcs.map((a) => `${a.source}>${a.target}*${a.multiplicity}`).join(",");
    return `${places}|${transitions}|${arcs}`;
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
      case "no":
        return {
          verdict: "no",
          detail: `Reaches a dead marking: ${NetAnalysis._formatMarking(rg.deadlocks()[0].marking, net)}.`,
        };
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

  /** A reachable marking as `P1=1, P2=0` over place names, in net order. */
  private static _formatMarking(marking: Marking, net: PetriNet): string {
    return net.places.map((p) => `${p.name}=${marking[p.id] ?? 0}`).join(", ");
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
}
