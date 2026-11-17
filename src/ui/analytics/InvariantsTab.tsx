import { type JSX, useMemo } from "react";
import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import type { AnalysisResult, Invariant } from "@/domain/analysis/types";
import type { PetriNet } from "@/domain/types";
import { copyMatrixLatex, copyMatrixText } from "@/ui/analytics/copyActions";
import type { HelpTopic } from "@/ui/analytics/helpTexts";
import { useNetNames } from "@/ui/analytics/useNetNames";
import {
  Card,
  CopyButton,
  CountMark,
  DISPLAY_CAP,
  HighlightChip,
  Note,
  Overflow,
} from "@/ui/analytics/widgets";

/**
 * P- and T-invariants, each shown three ways: the readable weighted sum over element names, the
 * structural weight vector, and the system law (a P-invariant's conserved token total `Yᵀ·M₀`, a
 * T-invariant's return-to-M₀ firing multiset `σ`), plus the coverage summary. Every invariant is a
 * chip that lights its support set on the canvas. Then the incidence matrix they are computed from.
 */
export function InvariantsTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { net, placeName, transitionName } = useNetNames();
  // Order arrays rebuild only when the net changes, not on every render.
  const placeOrder = useMemo(() => net.places.map((p) => p.id), [net.places]);
  const transitionOrder = useMemo(() => net.transitions.map((t) => t.id), [net.transitions]);
  // M0 (each place's persisted tokens) fixes the conserved value k in a P-invariant's system law.
  const m0 = useMemo(
    () => Object.fromEntries(net.places.map((p) => [p.id, p.tokens])),
    [net.places],
  );
  const { invariants } = result;
  return (
    <div className="flex flex-col gap-3">
      <InvariantCard
        title="Place invariants"
        kind="place"
        invariants={invariants.place}
        truncated={invariants.placeTruncated}
        order={placeOrder}
        nameOf={placeName}
        m0={m0}
        covered={invariants.placesCovered}
        coveredNote="All places covered, so the net is structurally bounded and conservative."
      />
      <InvariantCard
        title="Transition invariants"
        kind="transition"
        invariants={invariants.transition}
        truncated={invariants.transitionTruncated}
        order={transitionOrder}
        nameOf={transitionName}
        m0={m0}
        covered={invariants.transitionsCovered}
        coveredNote="All transitions covered, so the net is consistent."
      />
      <IncidenceMatrixCard net={net} />
    </div>
  );
}

function InvariantCard({
  title,
  kind,
  invariants,
  truncated,
  order,
  nameOf,
  m0,
  covered,
  coveredNote,
}: {
  title: HelpTopic;
  kind: "place" | "transition";
  invariants: Invariant[];
  truncated: boolean;
  order: string[];
  nameOf: (id: string) => string;
  m0: Record<string, number>;
  covered: boolean;
  coveredNote: string;
}): JSX.Element {
  return (
    <Card
      title={title}
      help={title}
      mark={truncated ? undefined : <CountMark>{invariants.length}</CountMark>}
    >
      {truncated ? (
        // A truncated family yields an empty list that does NOT mean "none". Say so per family, so
        // an overflow on one family never hides the other family that computed fine.
        <Note>Too many to enumerate within the safety cap. Simplify the net to list them.</Note>
      ) : invariants.length === 0 ? (
        <p>none</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {invariants.slice(0, DISPLAY_CAP).map((inv) => {
              // Support set in net order (both the canvas spotlight and the chip's lit-state key).
              const ids = order.filter((id) => inv.weights[id] !== undefined);
              const n = invariantNotation(inv, order, nameOf, kind, m0);
              return (
                // Key on the id-based support (element names can collide); display uses names.
                <li key={invariantKey(inv)}>
                  <HighlightChip target={{ nodes: ids, arcs: [] }} layout="row">
                    <span className="font-mono">{n.sum}</span>
                    <span className="font-mono text-[13px] text-fg-subtle">
                      {n.vector} · {n.system}
                    </span>
                  </HighlightChip>
                </li>
              );
            })}
          </ul>
          <Overflow total={invariants.length} />
          {covered && <p>{coveredNote}</p>}
        </>
      )}
    </Card>
  );
}

/**
 * The incidence matrix as a table: one row per place, one column per transition, names in the
 * headers. A large matrix scrolls inside the card. Two buttons copy it for a report.
 */
function IncidenceMatrixCard({ net }: { net: PetriNet }): JSX.Element {
  const matrix = useMemo(() => new IncidenceMatrix(net), [net]);
  const empty = net.places.length === 0 || net.transitions.length === 0;
  return (
    <Card
      title="Incidence matrix"
      help="Incidence matrix"
      mark={
        empty ? undefined : (
          <CountMark>
            {net.places.length} × {net.transitions.length}
          </CountMark>
        )
      }
    >
      {empty ? (
        <p>none</p>
      ) : (
        <>
          <div className="max-h-72 overflow-auto rounded border border-line">
            <table className="border-separate border-spacing-0 font-mono text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-20 border-line border-r border-b bg-surface-subtle" />
                  {net.transitions.map((t) => (
                    <th
                      key={t.id}
                      scope="col"
                      className="sticky top-0 z-10 whitespace-nowrap border-line border-b bg-surface-subtle px-2 py-1 text-right font-medium text-fg"
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {net.places.map((p, i) => (
                  <tr key={p.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 whitespace-nowrap border-line border-r bg-surface-subtle px-2 py-1 text-left font-medium text-fg"
                    >
                      {p.name}
                    </th>
                    {matrix.c[i].map((value, j) => (
                      <td
                        // biome-ignore lint/suspicious/noArrayIndexKey: a column's index is its transition; the row never reorders
                        key={j}
                        className={`px-2 py-1 text-right ${value === 0 ? "text-fg-faint" : "text-fg-strong"}`}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton onClick={copyMatrixText}>Copy as text</CopyButton>
            <CopyButton onClick={copyMatrixLatex}>Copy as LaTeX</CopyButton>
          </div>
        </>
      )}
    </Card>
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
 *  - `sum`:    the readable weighted sum over names (`2·P1 + P3`);
 *  - `vector`: the structural weight vector over the full basis in net order, zeros included
 *               (`Yᵀ=(1, 0, 1)` for places, `Xᵀ=(…)` for transitions);
 *  - `system`: the system law, meaning a P-invariant's conserved token total `Yᵀ·M₀ = k` (k read from M0),
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
