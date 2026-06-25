import type { Arc, Marking, PetriNet } from "@/domain/types";

/**
 * Pure, framework-free firing engine for classic weighted P/T nets.
 *
 * No React, no DOM, no store imports — `fire` is a pure marking->marking transform,
 * so a future auto-runner, step-back history, and analysis tools reuse it unchanged.
 * Enabledness and firing read arc weights only; future arc `type`s and place
 * `capacity` plug into `isEnabled`/`fire` without touching callers.
 */
export class PetriNetEngine {
  private readonly _net: PetriNet;
  /** transition id -> incoming arcs (place -> transition). */
  private readonly _inputs = new Map<string, Arc[]>();
  /** transition id -> outgoing arcs (transition -> place). */
  private readonly _outputs = new Map<string, Arc[]>();

  constructor(net: PetriNet) {
    this._net = net;
    for (const t of net.transitions) {
      this._inputs.set(t.id, []);
      this._outputs.set(t.id, []);
    }
    // Bipartite routing: only transition ids are keys, so the optional-chained
    // push lands each arc on the correct side and ignores the place endpoint.
    for (const arc of net.arcs) {
      this._inputs.get(arc.target)?.push(arc);
      this._outputs.get(arc.source)?.push(arc);
    }
  }

  /** Initial marking M0, read from each place's `tokens`. */
  static initialMarking(net: PetriNet): Marking {
    const marking: Marking = {};
    for (const place of net.places) {
      marking[place.id] = place.tokens;
    }
    return marking;
  }

  /** True iff every input place holds at least the connecting arc's weight. */
  isEnabled(transitionId: string, marking: Marking): boolean {
    const inputs = this._inputs.get(transitionId);
    return inputs !== undefined && PetriNetEngine._enabledBy(inputs, marking);
  }

  enabledTransitions(marking: Marking): string[] {
    return this._net.transitions.filter((t) => this.isEnabled(t.id, marking)).map((t) => t.id);
  }

  /**
   * Fire a transition, returning a NEW marking. The input marking is never mutated.
   * Throws if the transition is unknown or not enabled.
   */
  fire(transitionId: string, marking: Marking): Marking {
    const inputs = this._inputs.get(transitionId);
    const outputs = this._outputs.get(transitionId);
    if (!inputs || !outputs || !PetriNetEngine._enabledBy(inputs, marking)) {
      throw new Error(`Cannot fire transition "${transitionId}": not enabled`);
    }
    const next: Marking = { ...marking };
    for (const arc of inputs) {
      next[arc.source] = (next[arc.source] ?? 0) - arc.multiplicity;
    }
    for (const arc of outputs) {
      next[arc.target] = (next[arc.target] ?? 0) + arc.multiplicity;
    }
    return next;
  }

  private static _enabledBy(inputs: Arc[], marking: Marking): boolean {
    return inputs.every((arc) => (marking[arc.source] ?? 0) >= arc.multiplicity);
  }
}
