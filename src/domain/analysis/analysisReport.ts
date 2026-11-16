import { NetClassification } from "@/domain/analysis/classification";
import { MatrixFormat } from "@/domain/analysis/matrixFormat";
import { ReachabilityGraph } from "@/domain/analysis/reachabilityGraph";
import type { AnalysisResult, Invariant, PropertyResult, Verdict } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { PetriNet } from "@/domain/types";

/** Options for {@link AnalysisReport.build}. */
interface ReportOptions {
  /** The net changed after these results were computed. */
  stale: boolean;
}

const VERDICT_WORDS: Record<Verdict, string> = { yes: "Yes", no: "No", indeterminate: "Unknown" };

/**
 * The whole analysis as plain text for a report, ready to paste into a document. Pure and
 * framework-free. Plain ASCII, with names (not ids) for every place and transition.
 */
export class AnalysisReport {
  static build(net: PetriNet, result: AnalysisResult, opts: ReportOptions): string {
    const placeName = NetNames.resolver(net.places);
    const transitionName = NetNames.resolver(net.transitions);
    const nodeName = NetNames.resolver([...net.places, ...net.transitions]);
    const lines: string[] = ["Analysis", "", AnalysisReport._status(result)];
    if (opts.stale) {
      lines.push("Out of date: the net changed after these results were computed.");
    }

    lines.push("", "Properties");
    for (const [title, r] of AnalysisReport._properties(result)) {
      lines.push(...AnalysisReport._property(title, r));
    }

    lines.push("", "Net classes");
    const classes = NetClassification.classify(net);
    const classRows: [string, PropertyResult][] = [
      ["Ordinary", AnalysisReport._asProperty(classes.ordinary)],
      ["State machine", AnalysisReport._asProperty(classes.stateMachine)],
      ["Marked graph", AnalysisReport._asProperty(classes.markedGraph)],
      ["Free choice", AnalysisReport._asProperty(classes.freeChoice)],
    ];
    for (const [title, r] of classRows) lines.push(...AnalysisReport._property(title, r));

    lines.push("", "Invariants");
    lines.push(
      ...AnalysisReport._invariants(
        "Place invariants",
        result.invariants.place,
        result.invariants.placeTruncated,
        net.places.map((p) => p.id),
        placeName,
      ),
      ...AnalysisReport._invariants(
        "Transition invariants",
        result.invariants.transition,
        result.invariants.transitionTruncated,
        net.transitions.map((t) => t.id),
        transitionName,
      ),
    );

    const d = result.diagnostics;
    const list = (ids: string[], nameOf: (id: string) => string): string =>
      ids.length === 0 ? "none" : ids.map(nameOf).join(", ");
    lines.push("", "Structure");
    lines.push(
      d.cyclicComponents.length === 0
        ? "Loops: none (the net has no cycle)."
        : `Loops: ${d.cyclicComponents.length}`,
    );
    for (const loop of d.cyclicComponents) lines.push(`  - ${loop.map(nodeName).join(", ")}`);
    lines.push(
      `Connected: ${d.connected ? "Yes" : "No"}`,
      `Source places: ${list(d.sourcePlaces, placeName)}`,
      `Sink places: ${list(d.sinkPlaces, placeName)}`,
      `Source transitions: ${list(d.sourceTransitions, transitionName)}`,
      `Sink transitions: ${list(d.sinkTransitions, transitionName)}`,
      `Isolated elements: ${list(d.isolated, nodeName)}`,
    );

    lines.push("", "Place bounds");
    if (result.placeBounds === null) {
      lines.push("Not computed, because the full analysis has not run.");
    } else {
      const { max, exact } = result.placeBounds;
      if (!exact) lines.push("Lower limits only: the state space was not explored completely.");
      for (const p of net.places) {
        lines.push(`${p.name}: ${exact ? "" : "at least "}${max[p.id] ?? 0}`);
      }
      if (net.places.length === 0) lines.push("none");
    }

    lines.push("", "Incidence matrix", MatrixFormat.toText(net));
    return lines.join("\n");
  }

  private static _status(result: AnalysisResult): string {
    if (result.placeBounds === null) {
      return "Full analysis: not run. Properties that need the state space are unknown.";
    }
    const cap = ReachabilityGraph.STATE_CAP.toLocaleString("en-US");
    const n = result.exploredStates.toLocaleString("en-US");
    if (result.stateSpaceComplete) {
      return `Full analysis: run. All ${n} reachable markings were explored.`;
    }
    if (result.stateSpaceExceeded) {
      return `Full analysis: run, but stopped at the ${cap}-marking cap after ${n} markings. Results that need the whole state space are unknown.`;
    }
    return `Full analysis: run, but the net is unbounded, so only part of the state space (${n} markings) was explored. Results that need the whole state space are unknown.`;
  }

  private static _properties(result: AnalysisResult): [string, PropertyResult][] {
    const b = result.boundedness;
    const unsettled = "Not settled: the state space was not explored completely.";
    const bounded: PropertyResult = {
      verdict: b.bounded,
      detail:
        b.source === "structural"
          ? "A place invariant covers every place."
          : b.bounded === "no"
            ? "A firing sequence pumps a place without limit."
            : b.bounded === "yes"
              ? "The state space is finite."
              : unsettled,
      items: b.bound !== null ? [`Bound k = ${b.bound}.`] : undefined,
    };
    const safe: PropertyResult = {
      verdict: b.safe,
      detail:
        b.safe === "yes"
          ? "Every place holds at most one token."
          : b.safe === "no"
            ? "A place can hold more than one token."
            : unsettled,
    };
    return [
      ["Bounded", bounded],
      ["Safe", safe],
      ["Conservative", result.conservative],
      ["Live", result.live],
      ["Quasi-live", result.quasiLive],
      ["Reversible", result.reversible],
      ["Deadlock-free", result.deadlockFree],
    ];
  }

  private static _asProperty(c: { verdict: Verdict; reasons: string[] }): PropertyResult {
    return { verdict: c.verdict, detail: c.reasons[0], items: c.reasons.slice(1) };
  }

  /** `Title: Yes. reason`, then one `  - item` line per bullet. */
  private static _property(title: string, r: PropertyResult): string[] {
    return [
      `${title}: ${VERDICT_WORDS[r.verdict]}. ${r.detail}`,
      ...(r.items ?? []).map((item) => `  - ${item}`),
    ];
  }

  private static _invariants(
    title: string,
    invariants: Invariant[],
    truncated: boolean,
    order: string[],
    nameOf: (id: string) => string,
  ): string[] {
    if (truncated) return [`${title}: too many to list.`];
    if (invariants.length === 0) return [`${title}: none`];
    const sum = (inv: Invariant): string =>
      order
        .filter((id) => inv.weights[id] !== undefined)
        .map((id) => (inv.weights[id] === 1 ? nameOf(id) : `${inv.weights[id]}*${nameOf(id)}`))
        .join(" + ");
    return [`${title}: ${invariants.length}`, ...invariants.map((inv) => `  - ${sum(inv)}`)];
  }
}
