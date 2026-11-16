import type { Classification, ClassResult } from "@/domain/analysis/types";
import type { Arc, PetriNet } from "@/domain/types";

/**
 * The four classic structural classifications of a P/T net (ordinary, state machine, marked graph,
 * free choice), each decided from the net's shape alone (arc weights and distinct in/out neighbours),
 * with no state-space search. Pure and framework-free; the erroneous-element ids let the UI spotlight
 * what breaks each class.
 *
 * Distinct-neighbour counting collapses parallel arcs and ignores dangling arcs, matching the rest of
 * the analysis engine. State machine, marked graph and free choice follow the textbook definition
 * (Murata 1989): they require an ordinary net, so any arc with a weight above 1 makes them answer
 * "no". The heavy arcs are reported in `erroneousArcs` so the UI can mark them on the canvas.
 */
export class NetClassification {
  static classify(net: PetriNet): Classification {
    const placeIds = new Set(net.places.map((p) => p.id));
    const transitionIds = new Set(net.transitions.map((t) => t.id));
    const tIn = new Map<string, Set<string>>(net.transitions.map((t) => [t.id, new Set()]));
    const tOut = new Map<string, Set<string>>(net.transitions.map((t) => [t.id, new Set()]));
    const pIn = new Map<string, Set<string>>(net.places.map((p) => [p.id, new Set()]));
    const pOut = new Map<string, Set<string>>(net.places.map((p) => [p.id, new Set()]));
    for (const arc of net.arcs) {
      if (placeIds.has(arc.source) && transitionIds.has(arc.target)) {
        tIn.get(arc.target)?.add(arc.source);
        pOut.get(arc.source)?.add(arc.target);
      } else if (transitionIds.has(arc.source) && placeIds.has(arc.target)) {
        tOut.get(arc.source)?.add(arc.target);
        pIn.get(arc.target)?.add(arc.source);
      }
    }
    const heavy = net.arcs.filter((a) => a.multiplicity > 1);
    return {
      ordinary: NetClassification._ordinary(heavy),
      stateMachine: NetClassification._requireOrdinary(
        NetClassification._stateMachine(net, tIn, tOut),
        heavy,
        "a state machine",
      ),
      markedGraph: NetClassification._requireOrdinary(
        NetClassification._markedGraph(net, pIn, pOut),
        heavy,
        "a marked graph",
      ),
      freeChoice: NetClassification._requireOrdinary(
        NetClassification._freeChoice(net, placeIds, transitionIds, tIn, pOut),
        heavy,
        "a free-choice net",
      ),
    };
  }

  /**
   * Applies the textbook ordinary-net requirement to a shape verdict. With no heavy arc the shape
   * result stands. Otherwise the answer is "no": a fitting shape gets one reason that names both
   * facts, a broken shape keeps its own reason and gains the weight reason. The heavy arcs are listed.
   */
  private static _requireOrdinary(shape: ClassResult, heavy: Arc[], article: string): ClassResult {
    if (heavy.length === 0) return shape;
    const n = heavy.length;
    const weight = `${NetClassification._count(n, "arc")} ${n === 1 ? "has" : "have"} a weight above 1.`;
    const reasons =
      shape.verdict === "yes"
        ? [`The shape fits ${article}, but ${weight.charAt(0).toLowerCase()}${weight.slice(1)}`]
        : [...shape.reasons, weight];
    return {
      verdict: "no",
      reasons,
      erroneous: shape.erroneous,
      erroneousArcs: heavy.map((a) => a.id),
    };
  }

  /** Ordinary ⇔ every arc has weight 1. Erroneous: both endpoints of each weighted arc. */
  private static _ordinary(weighted: Arc[]): ClassResult {
    if (weighted.length === 0) {
      return {
        verdict: "yes",
        reasons: ["Every arc has weight 1."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    const erroneous = [...new Set(weighted.flatMap((a) => [a.source, a.target]))];
    const n = weighted.length;
    return {
      verdict: "no",
      reasons: [
        `${NetClassification._count(n, "arc")} ${n === 1 ? "has" : "have"} a weight above 1.`,
      ],
      erroneous,
      erroneousArcs: weighted.map((a) => a.id),
    };
  }

  /** State machine ⇔ every transition has exactly one input place and one output place. */
  private static _stateMachine(
    net: PetriNet,
    tIn: Map<string, Set<string>>,
    tOut: Map<string, Set<string>>,
  ): ClassResult {
    if (net.transitions.length === 0) {
      return {
        verdict: "yes",
        reasons: ["No transitions, so this holds vacuously."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    const bad = net.transitions.filter(
      (t) => (tIn.get(t.id)?.size ?? 0) !== 1 || (tOut.get(t.id)?.size ?? 0) !== 1,
    );
    if (bad.length === 0) {
      return {
        verdict: "yes",
        reasons: ["Every transition has exactly one input and one output place."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    return {
      verdict: "no",
      reasons: [
        `${NetClassification._count(bad.length, "transition")} lack exactly one input and one output place.`,
      ],
      erroneous: bad.map((t) => t.id),
      erroneousArcs: [],
    };
  }

  /** Marked graph ⇔ every place has exactly one input transition and one output transition. */
  private static _markedGraph(
    net: PetriNet,
    pIn: Map<string, Set<string>>,
    pOut: Map<string, Set<string>>,
  ): ClassResult {
    if (net.places.length === 0) {
      return {
        verdict: "yes",
        reasons: ["No places, so this holds vacuously."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    const bad = net.places.filter(
      (p) => (pIn.get(p.id)?.size ?? 0) !== 1 || (pOut.get(p.id)?.size ?? 0) !== 1,
    );
    if (bad.length === 0) {
      return {
        verdict: "yes",
        reasons: ["Every place has exactly one input and one output transition."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    return {
      verdict: "no",
      reasons: [
        `${NetClassification._count(bad.length, "place")} lack exactly one input and one output transition.`,
      ],
      erroneous: bad.map((p) => p.id),
      erroneousArcs: [],
    };
  }

  /**
   * Free choice ⇔ no arc p→t where p has more than one output transition AND t has more than one
   * input place (a shared place must not force a conflict). Erroneous: the places and transitions of
   * every violating arc.
   */
  private static _freeChoice(
    net: PetriNet,
    placeIds: Set<string>,
    transitionIds: Set<string>,
    tIn: Map<string, Set<string>>,
    pOut: Map<string, Set<string>>,
  ): ClassResult {
    const erroneous = new Set<string>();
    let violations = 0;
    for (const arc of net.arcs) {
      if (!placeIds.has(arc.source) || !transitionIds.has(arc.target)) continue;
      if ((pOut.get(arc.source)?.size ?? 0) > 1 && (tIn.get(arc.target)?.size ?? 0) > 1) {
        violations++;
        erroneous.add(arc.source);
        erroneous.add(arc.target);
      }
    }
    if (violations === 0) {
      return {
        verdict: "yes",
        reasons: ["No place with several outputs feeds a transition that has other inputs."],
        erroneous: [],
        erroneousArcs: [],
      };
    }
    return {
      verdict: "no",
      reasons: [
        `${NetClassification._count(violations, "arc")} break free choice: a place with several outputs feeds a transition that also has other input places.`,
      ],
      erroneous: [...erroneous],
      erroneousArcs: [],
    };
  }

  /** "1 arc" / "3 arcs": a count with a singular/plural noun. */
  private static _count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? "" : "s"}`;
  }
}
