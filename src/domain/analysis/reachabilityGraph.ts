import { Tarjan } from "@/domain/analysis/tarjan";
import type { Deadlock, Verdict } from "@/domain/analysis/types";
import { PetriNetEngine } from "@/domain/engine";
import type { Marking, PetriNet } from "@/domain/types";

/** A directed edge of the reachability graph: firing `t` moves to node `to`. */
interface Edge {
  to: number;
  t: string;
}

/**
 * The behavioural layer of net analysis: the reachability graph from M0, explored breadth-first
 * via {@link PetriNetEngine} up to a fixed state cap. Pure and framework-free like the engine and
 * the algebraic layer — no React/DOM/store imports — so it is unit-testable in isolation and
 * worker-ready later.
 *
 * From the (possibly partial) graph it settles the behavioural properties as three-valued
 * {@link Verdict}s, never claiming a result it could not actually prove:
 *   - **bounded / safe** — exact bound k from the explored markings; ancestor-covering proves
 *     unboundedness (the pumping-lemma shortcut, not full Karp–Miller); the cap leaves it `indeterminate`.
 *   - **live (L4)** — every terminal SCC of the graph fires every transition.
 *   - **reversible** — the whole graph is a single SCC (M0 reachable from everywhere).
 *   - **deadlock-free** — no reachable marking is dead; any found dead marking is a real witness.
 *   - **dead / quasi-live transitions** — transitions firing on no edge of the graph.
 *
 * A verdict that needs the *whole* finite graph (live, reversible, dead transitions, exact bound)
 * is only conclusive when {@link complete}; otherwise it reads `indeterminate`. Deadlock witnesses
 * stand on their own — a dead marking reached before the cap is real regardless of completeness.
 */
export class ReachabilityGraph {
  static readonly STATE_CAP = 10_000;

  /** Exploration stopped at the state cap, so the graph is only a prefix of the real one. */
  readonly exceeded: boolean;
  /** A reached marking strictly covered an ancestor on its path ⇒ the net is unbounded. */
  readonly unbounded: boolean;
  /** The full finite graph was built — neither capped nor pruned for unboundedness. */
  readonly complete: boolean;
  /** Number of distinct markings discovered. */
  readonly states: number;

  private readonly _bound: number;
  private readonly _deadlocks: Deadlock[];
  private readonly _deadTransitions: string[];
  /** Every terminal SCC fires every transition (the L4 witness; trust only when complete). */
  private readonly _liveByTerminalScc: boolean;
  /** The graph is one strongly-connected component (the reversibility witness; trust when complete). */
  private readonly _singleScc: boolean;

  constructor(net: PetriNet, cap: number = ReachabilityGraph.STATE_CAP) {
    const engine = new PetriNetEngine(net);
    const placeIds = net.places.map((p) => p.id);
    const transitionCount = net.transitions.length;

    const markings: Marking[] = [];
    const parent: number[] = [];
    const via: string[] = []; // transition id of the parent→node edge ("" for the root)
    const adjacency: Edge[][] = [];
    const indexByKey = new Map<string, number>();
    const fired = new Set<string>();
    const deadlockNodes: number[] = [];

    const key = (m: Marking): string => placeIds.map((id) => m[id] ?? 0).join(",");
    const addNode = (m: Marking, from: number, t: string): number => {
      const index = markings.length;
      markings.push(m);
      parent.push(from);
      via.push(t);
      adjacency.push([]);
      indexByKey.set(key(m), index);
      return index;
    };

    // `next` strictly covers an ancestor on its own path ⇒ that segment is a pumpable cycle that
    // grows the marking without bound ⇒ the net is unbounded.
    const coversAncestor = (next: Marking, from: number): boolean => {
      for (let a = from; a !== -1; a = parent[a]) {
        const ancestor = markings[a];
        let dominates = true;
        let strict = false;
        for (const id of placeIds) {
          const diff = (next[id] ?? 0) - (ancestor[id] ?? 0);
          if (diff < 0) {
            dominates = false;
            break;
          }
          if (diff > 0) strict = true;
        }
        if (dominates && strict) return true;
      }
      return false;
    };

    addNode(PetriNetEngine.initialMarking(net), -1, "");
    const queue: number[] = [0];
    let exceeded = false;
    let unbounded = false;

    // BFS by a moving head index (cheaper than shift()); the queue grows as nodes are discovered.
    bfs: for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      const marking = markings[node];
      const enabled = engine.enabledTransitions(marking);
      if (enabled.length === 0) {
        deadlockNodes.push(node);
        continue;
      }
      for (const t of enabled) {
        fired.add(t);
        const next = engine.fire(t, marking);
        const seen = indexByKey.get(key(next));
        if (seen !== undefined) {
          adjacency[node].push({ to: seen, t });
          continue;
        }
        if (coversAncestor(next, node)) {
          // Record the covering node (so the edge exists) but never expand it.
          unbounded = true;
          adjacency[node].push({ to: addNode(next, node, t), t });
          continue;
        }
        if (markings.length >= cap) {
          exceeded = true;
          break bfs;
        }
        const created = addNode(next, node, t);
        adjacency[node].push({ to: created, t });
        queue.push(created);
      }
    }

    this.exceeded = exceeded;
    this.unbounded = unbounded;
    this.complete = !exceeded && !unbounded;
    this.states = markings.length;

    this._bound = ReachabilityGraph._maxTokens(markings, placeIds);
    this._deadlocks = deadlockNodes.map((node) => ({
      marking: markings[node],
      path: ReachabilityGraph._pathTo(node, parent, via),
    }));
    this._deadTransitions = net.transitions.map((t) => t.id).filter((id) => !fired.has(id));

    // Tarjan needs only the edge targets; the labels stay on `adjacency` for the L4 check below.
    const scc = Tarjan.components(adjacency.map((edges) => edges.map((e) => e.to)));
    this._singleScc = scc.count === 1;
    this._liveByTerminalScc = ReachabilityGraph._terminalSccsFireEveryTransition(
      adjacency,
      scc.componentOf,
      scc.count,
      transitionCount,
    );
  }

  /** Exact bound k (max tokens in any place) once the graph is complete; otherwise unknown. */
  bound(): number | null {
    return this.complete ? this._bound : null;
  }

  isBounded(): Verdict {
    if (this.unbounded) return "no";
    if (this.exceeded) return "indeterminate";
    return "yes";
  }

  isSafe(): Verdict {
    const bounded = this.isBounded();
    if (bounded !== "yes") return bounded;
    return this._bound <= 1 ? "yes" : "no";
  }

  isLive(): Verdict {
    if (!this.complete) return "indeterminate";
    return this._liveByTerminalScc ? "yes" : "no";
  }

  isReversible(): Verdict {
    if (!this.complete) return "indeterminate";
    return this._singleScc ? "yes" : "no";
  }

  isDeadlockFree(): Verdict {
    if (this._deadlocks.length > 0) return "no";
    return this.complete ? "yes" : "indeterminate";
  }

  isQuasiLive(): Verdict {
    if (!this.complete) return "indeterminate";
    return this._deadTransitions.length === 0 ? "yes" : "no";
  }

  /** Reachable dead markings with a firing path from M0 — real witnesses even on a partial graph. */
  deadlocks(): Deadlock[] {
    return this._deadlocks;
  }

  /** Transitions firing on no edge. Conclusive only once exploration is {@link complete}. */
  deadTransitions(): string[] {
    return this.complete ? this._deadTransitions : [];
  }

  private static _maxTokens(markings: Marking[], placeIds: string[]): number {
    let max = 0;
    for (const m of markings) {
      for (const id of placeIds) {
        const tokens = m[id] ?? 0;
        if (tokens > max) max = tokens;
      }
    }
    return max;
  }

  private static _pathTo(node: number, parent: number[], via: string[]): string[] {
    const path: string[] = [];
    for (let n = node; parent[n] !== -1; n = parent[n]) path.push(via[n]);
    return path.reverse();
  }

  /**
   * L4-liveness witness: every terminal SCC (one with no edge leaving to another component) fires
   * every transition on its internal edges. Once a run settles into a terminal SCC it stays there
   * forever, so a transition missing from one can never fire again — exactly the L4 failure.
   */
  private static _terminalSccsFireEveryTransition(
    adjacency: Edge[][],
    componentOf: number[],
    count: number,
    transitionCount: number,
  ): boolean {
    // A net with no transitions can never fire: its sole marking is a deadlock, so it is not live.
    // (Without this guard the `labels.size < transitionCount` test below is `0 < 0` — vacuously
    // "live", which would contradict the deadlock that same marking represents.)
    if (transitionCount === 0) return false;
    const terminal = new Array<boolean>(count).fill(true);
    const labels: Set<string>[] = Array.from({ length: count }, () => new Set<string>());
    for (let v = 0; v < adjacency.length; v++) {
      const cv = componentOf[v];
      for (const edge of adjacency[v]) {
        const cw = componentOf[edge.to];
        if (cw === cv) labels[cv].add(edge.t);
        else terminal[cv] = false;
      }
    }
    for (let c = 0; c < count; c++) {
      if (terminal[c] && labels[c].size < transitionCount) return false;
    }
    return true;
  }
}
