import type { PetriNet } from "@/domain/types";

/**
 * Flow matrices of a P/T net with a stable, net-order index — pure data, no React/DOM/store
 * imports, mirroring {@link PetriNetEngine}. Rows are places (in `net.places` order), columns
 * are transitions (in `net.transitions` order):
 *
 *   - `pre[p][t]`  — weight of the place→transition arc (tokens transition `t` consumes from `p`)
 *   - `post[p][t]` — weight of the transition→place arc (tokens `t` produces into `p`)
 *   - `c[p][t]`    — the incidence matrix `C = Post − Pre`
 *
 * Parallel arcs on the same (place, transition) pair are summed; arcs whose endpoint is unknown
 * (dangling) are ignored. The `places`/`transitions` id arrays are the canonical index that the
 * invariant and reachability layers share, so a vector position always maps back to one element.
 */
export class IncidenceMatrix {
  /** Place ids in stable row order. */
  readonly places: string[];
  /** Transition ids in stable column order. */
  readonly transitions: string[];
  readonly pre: number[][];
  readonly post: number[][];
  readonly c: number[][];

  constructor(net: PetriNet) {
    this.places = net.places.map((p) => p.id);
    this.transitions = net.transitions.map((t) => t.id);
    const placeRow = new Map(this.places.map((id, i) => [id, i] as const));
    const transitionCol = new Map(this.transitions.map((id, i) => [id, i] as const));

    const rows = this.places.length;
    const cols = this.transitions.length;
    this.pre = IncidenceMatrix._zeros(rows, cols);
    this.post = IncidenceMatrix._zeros(rows, cols);

    // Bipartite routing: a place source means place→transition (Pre); otherwise it is a
    // transition→place arc (Post). Unknown endpoints leave both blocks untouched.
    for (const arc of net.arcs) {
      const fromPlace = placeRow.get(arc.source);
      if (fromPlace !== undefined) {
        const toTransition = transitionCol.get(arc.target);
        if (toTransition !== undefined) this.pre[fromPlace][toTransition] += arc.multiplicity;
      } else {
        const fromTransition = transitionCol.get(arc.source);
        const toPlace = placeRow.get(arc.target);
        if (fromTransition !== undefined && toPlace !== undefined) {
          this.post[toPlace][fromTransition] += arc.multiplicity;
        }
      }
    }

    this.c = this.post.map((row, p) => row.map((postWeight, t) => postWeight - this.pre[p][t]));
  }

  private static _zeros(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  }
}
