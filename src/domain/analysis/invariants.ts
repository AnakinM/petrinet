import type { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import type { Invariant } from "@/domain/analysis/types";

/**
 * Minimal semipositive P- and T-semiflows (place/transition invariants) of a net, computed
 * straight from its {@link IncidenceMatrix} with no external linear-algebra library — pure and
 * framework-free like {@link PetriNetEngine}.
 *
 * Both are minimal-support non-negative integer null-vectors of the incidence matrix `C`:
 *   - **P-invariants** `y ≥ 0` with `y·C = 0` — token weightings conserved by every firing.
 *   - **T-invariants** `x ≥ 0` with `C·x = 0` — firing multisets that return to the start marking.
 *
 * The core is one routine — minimal semipositive solutions of `A·v = 0` — run on `Cᵀ` for the
 * P-invariants and on `C` for the T-invariants. It is Fourier–Motzkin / Farkas elimination with
 * per-step minimal-support pruning (Colom–Silva): driving one constraint row to zero at a time by
 * adding each positive/negative generator pair, then dropping any vector whose support strictly
 * contains another's. The survivors are exactly the extreme rays of the solution cone — the
 * minimal-support semiflows — each reduced by the gcd of its entries.
 */
export class Invariants {
  /** Minimal P-semiflows: `y ≥ 0`, `y·C = 0`, keyed by place id. */
  static placeInvariants(m: IncidenceMatrix): Invariant[] {
    const ct = Invariants._transpose(m.c, m.places.length, m.transitions.length);
    return Invariants._minimalSemiflows(ct, m.places.length).map((v) =>
      Invariants._toInvariant(v, m.places),
    );
  }

  /** Minimal T-semiflows: `x ≥ 0`, `C·x = 0`, keyed by transition id. */
  static transitionInvariants(m: IncidenceMatrix): Invariant[] {
    return Invariants._minimalSemiflows(m.c, m.transitions.length).map((v) =>
      Invariants._toInvariant(v, m.transitions),
    );
  }

  /** True iff every id appears in the support of at least one invariant (its supports cover them). */
  static covers(invariants: Invariant[], ids: string[]): boolean {
    if (ids.length === 0) return true;
    const covered = new Set<string>();
    for (const inv of invariants) {
      for (const id of Object.keys(inv.weights)) covered.add(id);
    }
    return ids.every((id) => covered.has(id));
  }

  // --- core: minimal semipositive integer solutions of A·v = 0 ---------------

  private static _minimalSemiflows(a: number[][], cols: number): number[][] {
    // Generators start as the unit vectors (the minimal-support solutions of the empty system);
    // each constraint row of A is then eliminated in turn.
    let gens: number[][] = [];
    for (let j = 0; j < cols; j++) {
      const unit = new Array<number>(cols).fill(0);
      unit[j] = 1;
      gens.push(unit);
    }
    for (const row of a) {
      const zero: number[][] = [];
      const positive: { v: number[]; d: number }[] = [];
      const negative: { v: number[]; d: number }[] = [];
      for (const g of gens) {
        const d = Invariants._dot(row, g);
        if (d === 0) zero.push(g);
        else if (d > 0) positive.push({ v: g, d });
        else negative.push({ v: g, d });
      }
      // Generators already satisfying the row carry over; every +/− pair combines into a new
      // non-negative generator that cancels this row's component.
      const next = [...zero];
      for (const p of positive) {
        for (const n of negative) {
          const combo = new Array<number>(cols);
          for (let k = 0; k < cols; k++) combo[k] = -n.d * p.v[k] + p.d * n.v[k];
          Invariants._reduceByGcd(combo);
          next.push(combo);
        }
      }
      gens = Invariants._keepMinimalSupport(next);
    }
    return gens;
  }

  private static _dot(row: number[], v: number[]): number {
    let sum = 0;
    for (let k = 0; k < v.length; k++) sum += row[k] * v[k];
    return sum;
  }

  /** Drop zero/duplicate vectors and any whose support strictly contains another's. */
  private static _keepMinimalSupport(gens: number[][]): number[][] {
    const unique = new Map<string, number[]>();
    for (const g of gens) {
      if (g.some((x) => x !== 0)) unique.set(g.join(","), g);
    }
    const vectors = [...unique.values()];
    const supports = vectors.map((v) => Invariants._support(v));
    return vectors.filter(
      (_, i) =>
        !vectors.some((_, j) => j !== i && Invariants._strictSubset(supports[j], supports[i])),
    );
  }

  private static _support(v: number[]): Set<number> {
    const s = new Set<number>();
    for (let k = 0; k < v.length; k++) {
      if (v[k] !== 0) s.add(k);
    }
    return s;
  }

  private static _strictSubset(a: Set<number>, b: Set<number>): boolean {
    if (a.size >= b.size) return false;
    for (const x of a) {
      if (!b.has(x)) return false;
    }
    return true;
  }

  private static _reduceByGcd(v: number[]): void {
    let g = 0;
    for (const x of v) g = Invariants._gcd(g, Math.abs(x));
    if (g > 1) {
      for (let k = 0; k < v.length; k++) v[k] /= g;
    }
  }

  private static _gcd(a: number, b: number): number {
    while (b !== 0) [a, b] = [b, a % b];
    return a;
  }

  private static _transpose(matrix: number[][], rows: number, cols: number): number[][] {
    const t = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) t[j][i] = matrix[i][j];
    }
    return t;
  }

  private static _toInvariant(v: number[], ids: string[]): Invariant {
    const weights: Record<string, number> = {};
    for (let k = 0; k < v.length; k++) {
      if (v[k] !== 0) weights[ids[k]] = v[k];
    }
    return { weights };
  }
}
