/**
 * Iterative Tarjan strongly-connected-components over a directed graph given as a numeric
 * adjacency list (`adjacency[v]` holds the indices `v` has an edge to). Iterative — an explicit
 * work stack rather than recursion — so it stays safe on graphs as large as the reachability
 * graph's state cap, where deep recursion would overflow. Pure and framework-free, shared by the
 * behavioural layer ({@link ReachabilityGraph}, over the marking space) and the structural layer
 * ({@link NetStructure}, over the bipartite net graph).
 */
export class Tarjan {
  /** Each node's component id (0-based, in discovery order) and the total component count. */
  static components(adjacency: number[][]): { componentOf: number[]; count: number } {
    const n = adjacency.length;
    const index = new Array<number>(n).fill(-1);
    const low = new Array<number>(n).fill(0);
    const onStack = new Array<boolean>(n).fill(false);
    const componentOf = new Array<number>(n).fill(-1);
    const sccStack: number[] = [];
    let counter = 0;
    let count = 0;

    for (let root = 0; root < n; root++) {
      if (index[root] !== -1) continue;
      const work: { node: number; edge: number }[] = [{ node: root, edge: 0 }];
      while (work.length > 0) {
        const frame = work[work.length - 1];
        const v = frame.node;
        if (frame.edge === 0) {
          index[v] = counter;
          low[v] = counter;
          counter++;
          sccStack.push(v);
          onStack[v] = true;
        }
        if (frame.edge < adjacency[v].length) {
          const w = adjacency[v][frame.edge];
          frame.edge++;
          if (index[w] === -1) work.push({ node: w, edge: 0 });
          else if (onStack[w] && index[w] < low[v]) low[v] = index[w];
          continue;
        }
        // v fully explored: close its SCC if it is a root, then propagate its low-link upward.
        if (low[v] === index[v]) {
          let w = v;
          do {
            w = sccStack.pop() as number;
            onStack[w] = false;
            componentOf[w] = count;
          } while (w !== v);
          count++;
        }
        work.pop();
        const caller = work[work.length - 1];
        if (caller !== undefined && low[v] < low[caller.node]) low[caller.node] = low[v];
      }
    }
    return { componentOf, count };
  }
}
