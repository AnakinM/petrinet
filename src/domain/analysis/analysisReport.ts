import { NetClassification } from "@/domain/analysis/classification";
import { MatrixFormat } from "@/domain/analysis/matrixFormat";
import { NetAnalysis, NOT_COMPUTED, STATE_CAP_EXCEEDED } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, Invariant, PropertyResult, Verdict } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { PetriNet } from "@/domain/types";

/** Options for {@link AnalysisReport.build}. */
interface ReportOptions {
  /** The net changed after the last full analysis (the panel's "net changed" bar state). */
  stale: boolean;
}

/** Why the full analysis stopped early on an unbounded net. */
export const UNBOUNDED_NOTE = "The net is unbounded, so its reachability graph is infinite.";

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
    const lines: string[] = ["Analysis", "", AnalysisReport.status(result, opts.stale)];

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
      lines.push(NOT_COMPUTED);
    } else {
      const { max, exact, unbounded } = result.placeBounds;
      if (!exact) lines.push("Lower limits only: the state space was not explored completely.");
      const caveat = NetAnalysis.placeBoundsCaveat(result);
      if (caveat !== null) lines.push(caveat);
      for (const p of net.places) {
        const known = max[p.id];
        let value = "unknown";
        if (unbounded.includes(p.id)) value = "no bound (unbounded)";
        else if (known !== undefined) value = exact ? String(known) : `at least ${known}`;
        lines.push(`${p.name}: ${value}`);
      }
      if (net.places.length === 0) lines.push("none");
    }

    lines.push("", "Incidence matrix", MatrixFormat.toText(net));
    return lines.join("\n");
  }

  /** One line for the panel's bar state: not run, net changed since the last run, or up to date. */
  static status(result: AnalysisResult, stale: boolean): string {
    if (stale)
      return "The net changed after the last full analysis. Analyse again to update the results.";
    if (result.placeBounds === null) return "Some results need the full analysis.";
    return AnalysisReport.upToDate(result);
  }

  /**
   * The up-to-date line: how many markings the full analysis explored, plus the note for a capped or
   * unbounded state space. The panel's Analyse bar shows the same line.
   */
  static upToDate(result: AnalysisResult): string {
    const n = result.exploredStates;
    const base = `Analysis is up to date. Explored ${n.toLocaleString("en-US")} marking${n === 1 ? "" : "s"}.`;
    if (result.stateSpaceComplete) return base;
    if (result.stateSpaceExceeded) return `${base} ${STATE_CAP_EXCEEDED}`;
    return `${base} ${UNBOUNDED_NOTE}`;
  }

  private static _properties(result: AnalysisResult): [string, PropertyResult][] {
    const b = result.boundedness;
    return [
      ["Bounded", { verdict: b.bounded, ...NetAnalysis.boundedDetail(result) }],
      ["Safe", { verdict: b.safe, ...NetAnalysis.safeDetail(result) }],
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
