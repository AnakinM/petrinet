import { type JSX, useMemo } from "react";
import type { AnalysisResult, Invariant } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { DISPLAY_CAP, HighlightChip, Overflow, Section } from "@/ui/analytics/widgets";

/**
 * P- and T-invariants, each shown three ways — the readable weighted sum over element names, the
 * structural weight vector, and the system law (a P-invariant's conserved token total `Yᵀ·M₀`, a
 * T-invariant's return-to-M₀ firing multiset `σ`) — plus the coverage summary. Every invariant is a
 * chip: clicking it spotlights its support set on the canvas (and pans to it).
 */
export function InvariantsTab({ result }: { result: AnalysisResult }): JSX.Element {
  const net = useNetStore((s) => s.net);
  // A comma-joined key of the live highlight, so each chip can tell whether it is the lit one.
  const lit = useAnalyticsStore((s) => s.highlight).join(",");
  // Order arrays and resolvers rebuild only when the net changes, not on every render.
  const placeOrder = useMemo(() => net.places.map((p) => p.id), [net.places]);
  const transitionOrder = useMemo(() => net.transitions.map((t) => t.id), [net.transitions]);
  const placeName = useMemo(() => NetNames.resolver(net.places), [net.places]);
  const transitionName = useMemo(() => NetNames.resolver(net.transitions), [net.transitions]);
  // M0 (each place's persisted tokens) fixes the conserved value k in a P-invariant's system law.
  const m0 = useMemo(
    () => Object.fromEntries(net.places.map((p) => [p.id, p.tokens])),
    [net.places],
  );
  const { invariants } = result;
  return (
    <div className="flex flex-col gap-4">
      <InvariantSection
        title="Place invariants"
        help="A place invariant (P-invariant) is a positive place weighting whose weighted token sum is unchanged by every firing — a conservation law."
        kind="place"
        invariants={invariants.place}
        truncated={invariants.placeTruncated}
        order={placeOrder}
        nameOf={placeName}
        m0={m0}
        lit={lit}
        covered={invariants.placesCovered}
        coveredNote="All places covered, so the net is structurally bounded and conservative."
        emptyNote="No place invariants."
      />
      <InvariantSection
        title="Transition invariants"
        help="A transition invariant (T-invariant) is a multiset of firings that, run from a marking, returns the net to that same marking."
        kind="transition"
        invariants={invariants.transition}
        truncated={invariants.transitionTruncated}
        order={transitionOrder}
        nameOf={transitionName}
        m0={m0}
        lit={lit}
        covered={invariants.transitionsCovered}
        coveredNote="All transitions covered, so the net is consistent."
        emptyNote="No transition invariants."
      />
    </div>
  );
}

function InvariantSection({
  title,
  help,
  kind,
  invariants,
  truncated,
  order,
  nameOf,
  m0,
  lit,
  covered,
  coveredNote,
  emptyNote,
}: {
  title: string;
  help: string;
  kind: "place" | "transition";
  invariants: Invariant[];
  truncated: boolean;
  order: string[];
  nameOf: (id: string) => string;
  m0: Record<string, number>;
  lit: string;
  covered: boolean;
  coveredNote: string;
  emptyNote: string;
}): JSX.Element {
  return (
    <Section title={title} help={help}>
      {truncated ? (
        // A truncated family yields an empty list that does NOT mean "none" — say so per-family, so
        // an overflow on one family never hides the other family that computed fine.
        <p className="text-slate-400 text-sm">
          Too many to enumerate within the safety cap. Simplify the net to list them.
        </p>
      ) : invariants.length === 0 ? (
        <p className="text-slate-400 text-sm">{emptyNote}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {invariants.slice(0, DISPLAY_CAP).map((inv) => {
              // Support set in net order — both the canvas spotlight and the chip's lit-state key.
              const ids = order.filter((id) => inv.weights[id] !== undefined);
              const n = invariantNotation(inv, order, nameOf, kind, m0);
              return (
                // Key on the id-based support (element names can collide); display uses names.
                <li key={invariantKey(inv)}>
                  <HighlightChip ids={ids} lit={lit} size="row">
                    <span className="flex flex-col gap-0.5 font-mono leading-tight">
                      <span className="text-slate-700">{n.sum}</span>
                      <span className="text-[11px] text-slate-400">
                        {n.vector} · {n.system}
                      </span>
                    </span>
                  </HighlightChip>
                </li>
              );
            })}
          </ul>
          <Overflow total={invariants.length} />
          {covered && <p className="text-slate-500 text-xs">{coveredNote}</p>}
        </>
      )}
    </Section>
  );
}

/** A stable, collision-free key from the invariant's id→weight support (independent of names). */
function invariantKey(inv: Invariant): string {
  return Object.keys(inv.weights)
    .sort()
    .map((id) => `${id}:${inv.weights[id]}`)
    .join(",");
}

/** The readable weighted sum `2·P1 + P3` over element names, in net order, with zero weights omitted. */
function formatInvariant(inv: Invariant, order: string[], nameOf: (id: string) => string): string {
  const terms: string[] = [];
  for (const id of order) {
    const weight = inv.weights[id];
    if (weight === undefined) continue;
    terms.push(weight === 1 ? nameOf(id) : `${weight}·${nameOf(id)}`);
  }
  return terms.join(" + ");
}

/**
 * The three notations for one invariant:
 *  - `sum`    — the readable weighted sum over names (`2·P1 + P3`);
 *  - `vector` — the structural weight vector over the full basis in net order, zeros included
 *               (`Yᵀ=(1, 0, 1)` for places, `Xᵀ=(…)` for transitions);
 *  - `system` — the system law: a P-invariant's conserved token total `Yᵀ·M₀ = k` (k read from M0),
 *               a T-invariant's return-to-M₀ firing multiset `σ = {T1, T3}`.
 */
function invariantNotation(
  inv: Invariant,
  order: string[],
  nameOf: (id: string) => string,
  kind: "place" | "transition",
  m0: Record<string, number>,
): { sum: string; vector: string; system: string } {
  const symbol = kind === "place" ? "Y" : "X";
  const vector = `${symbol}ᵀ=(${order.map((id) => inv.weights[id] ?? 0).join(", ")})`;
  let system: string;
  if (kind === "place") {
    const k = order.reduce((acc, id) => acc + (inv.weights[id] ?? 0) * (m0[id] ?? 0), 0);
    system = `${symbol}ᵀ·M₀ = ${k}`;
  } else {
    const sigma = order
      .filter((id) => inv.weights[id] !== undefined)
      .map((id) => (inv.weights[id] === 1 ? nameOf(id) : `${inv.weights[id]}·${nameOf(id)}`))
      .join(", ");
    system = `σ = {${sigma}}`;
  }
  return { sum: formatInvariant(inv, order, nameOf), vector, system };
}
