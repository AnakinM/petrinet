import type { JSX } from "react";
import type { AnalysisResult, Invariant } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useNetStore } from "@/store/netStore";

/** Never render more than this many invariant rows; the rest collapse to a "showing N of M" note. */
const DISPLAY_CAP = 50;

/** P- and T-invariants rendered as weighted sums over element names, plus the coverage summary. */
export function InvariantsTab({ result }: { result: AnalysisResult }): JSX.Element {
  const net = useNetStore((s) => s.net);
  const { invariants } = result;
  return (
    <div className="flex flex-col gap-4">
      <InvariantSection
        title="Place invariants"
        invariants={invariants.place}
        order={net.places.map((p) => p.id)}
        nameOf={NetNames.resolver(net.places)}
        covered={invariants.placesCovered}
        coveredNote="All places covered — structurally bounded & conservative."
        emptyNote="No place invariants."
      />
      <InvariantSection
        title="Transition invariants"
        invariants={invariants.transition}
        order={net.transitions.map((t) => t.id)}
        nameOf={NetNames.resolver(net.transitions)}
        covered={invariants.transitionsCovered}
        coveredNote="All transitions covered — consistent."
        emptyNote="No transition invariants."
      />
    </div>
  );
}

function InvariantSection({
  title,
  invariants,
  order,
  nameOf,
  covered,
  coveredNote,
  emptyNote,
}: {
  title: string;
  invariants: Invariant[];
  order: string[];
  nameOf: (id: string) => string;
  covered: boolean;
  coveredNote: string;
  emptyNote: string;
}): JSX.Element {
  const shown = invariants.slice(0, DISPLAY_CAP);
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">{title}</h3>
      {invariants.length === 0 ? (
        <p className="text-slate-400 text-sm">{emptyNote}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {shown.map((inv) => (
              // Key on the id-based support (element names can collide); display uses names.
              <li
                key={invariantKey(inv)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-slate-700 text-sm"
              >
                {formatInvariant(inv, order, nameOf)}
              </li>
            ))}
          </ul>
          {invariants.length > DISPLAY_CAP && (
            <p className="text-slate-400 text-xs">
              Showing {DISPLAY_CAP} of {invariants.length}.
            </p>
          )}
          {covered && <p className="text-slate-500 text-xs">{coveredNote}</p>}
        </>
      )}
    </section>
  );
}

/** A stable, collision-free key from the invariant's id→weight support (independent of names). */
function invariantKey(inv: Invariant): string {
  return Object.keys(inv.weights)
    .sort()
    .map((id) => `${id}:${inv.weights[id]}`)
    .join(",");
}

/** Render a semiflow as `2·P1 + P3` over element names, in net order, with zero weights omitted. */
function formatInvariant(inv: Invariant, order: string[], nameOf: (id: string) => string): string {
  const terms: string[] = [];
  for (const id of order) {
    const weight = inv.weights[id];
    if (weight === undefined) continue;
    terms.push(weight === 1 ? nameOf(id) : `${weight}·${nameOf(id)}`);
  }
  return terms.join(" + ");
}
