import { Tarjan } from "@/domain/analysis/tarjan";
import type { StructuralDiagnostics } from "@/domain/analysis/types";
import type { PetriNet } from "@/domain/types";

/**
 * Structural diagnostics of the **net graph** itself — the directed bipartite graph whose nodes
 * are the places and transitions and whose edges are the arcs. Decided from the net's shape alone
 * with no state-space search (unlike {@link ReachabilityGraph}), so it is cheap and always runs.
 * Pure and framework-free, mirroring {@link PetriNetEngine} and the rest of the analysis layer.
 *
 * It reports: strongly-connected **loops** (cyclic SCCs of the net graph — not an enumeration of
 * simple cycles, which is exponential), **source/sink** places and transitions, **isolated**
 * nodes, and **weak connectedness**.
 *
 * Two boundary decisions, both tested:
 *   - **Dangling arcs** (an endpoint that is not a node of this net) are ignored, matching
 *     {@link IncidenceMatrix} — every algebraic and structural layer sees the same graph.
 *   - An **isolated** node (no incident arc) is reported only as isolated, never also as a source
 *     or sink, so the three categories stay disjoint and the UI never triple-lists one node.
 *   - The **empty net** is vacuously connected (no two nodes are separated): `connected = true`.
 */
export class NetStructure {
  static analyze(net: PetriNet): StructuralDiagnostics {
    const placeIds = net.places.map((p) => p.id);
    const transitionIds = net.transitions.map((t) => t.id);
    const nodes = [...placeIds, ...transitionIds];
    const indexOf = new Map(nodes.map((id, i) => [id, i] as const));
    const n = nodes.length;

    const directed: number[][] = Array.from({ length: n }, () => []);
    const undirected: number[][] = Array.from({ length: n }, () => []);
    const inDeg = new Array<number>(n).fill(0);
    const outDeg = new Array<number>(n).fill(0);

    for (const arc of net.arcs) {
      const from = indexOf.get(arc.source);
      const to = indexOf.get(arc.target);
      if (from === undefined || to === undefined) continue; // dangling arc — ignore
      directed[from].push(to);
      undirected[from].push(to);
      undirected[to].push(from);
      outDeg[from]++;
      inDeg[to]++;
    }

    // Source = no incoming arc, sink = no outgoing arc; an arc-less node is only `isolated`.
    const sourcePlaces: string[] = [];
    const sinkPlaces: string[] = [];
    const sourceTransitions: string[] = [];
    const sinkTransitions: string[] = [];
    const isolated: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = nodes[i];
      if (inDeg[i] === 0 && outDeg[i] === 0) {
        isolated.push(id);
        continue;
      }
      const isPlace = i < placeIds.length;
      if (inDeg[i] === 0) (isPlace ? sourcePlaces : sourceTransitions).push(id);
      if (outDeg[i] === 0) (isPlace ? sinkPlaces : sinkTransitions).push(id);
    }

    const { componentOf, count } = Tarjan.components(directed);
    const cyclicComponents = NetStructure._cyclicComponents(nodes, componentOf, count);

    return {
      cyclicComponents,
      acyclic: cyclicComponents.length === 0,
      sourcePlaces,
      sinkPlaces,
      sourceTransitions,
      sinkTransitions,
      isolated,
      connected: NetStructure._weaklyConnected(n, undirected),
    };
  }

  /**
   * The cyclic SCCs (more than one node — a bipartite net has no self-loops, so size 1 is always
   * acyclic), node ids in net order within each, components ordered by their smallest node index.
   */
  private static _cyclicComponents(
    nodes: string[],
    componentOf: number[],
    count: number,
  ): string[][] {
    const groups: number[][] = Array.from({ length: count }, () => []);
    for (let i = 0; i < componentOf.length; i++) groups[componentOf[i]].push(i);
    return groups
      .filter((g) => g.length > 1)
      .sort((a, b) => a[0] - b[0])
      .map((g) => g.map((i) => nodes[i]));
  }

  /** One DFS over the undirected net graph reaches every node iff there is a single weak component. */
  private static _weaklyConnected(n: number, undirected: number[][]): boolean {
    if (n === 0) return true; // vacuously connected — no two nodes to separate
    const seen = new Array<boolean>(n).fill(false);
    const stack = [0];
    seen[0] = true;
    let visited = 0;
    while (stack.length > 0) {
      const v = stack.pop() as number;
      visited++;
      for (const w of undirected[v]) {
        if (!seen[w]) {
          seen[w] = true;
          stack.push(w);
        }
      }
    }
    return visited === n;
  }
}
