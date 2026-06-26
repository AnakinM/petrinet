import { type JSX, useMemo } from "react";
import type { AnalysisResult, Invariant } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import { useNetStore } from "@/store/netStore";
import { DISPLAY_CAP, Overflow, Section } from "@/ui/analytics/widgets";

/** P- and T-invariants rendered as weighted sums over element names, plus the coverage summary. */
export function InvariantsTab({ result }: { result: AnalysisResult }): JSX.Element {
  const net = useNetStore((s) => s.net);
  // Order arrays and resolvers rebuild only when the net changes, not on every render.
  const placeOrder = useMemo(() => net.places.map((p) => p.id), [net.places]);
  const transitionOrder = useMemo(() => net.transitions.map((t) => t.id), [net.transitions]);
  const placeName = useMemo(() => NetNames.resolver(net.places), [net.places]);
  const transitionName = useMemo(() => NetNames.resolver(net.transitions), [net.transitions]);
  const { invariants } = result;
  return (
    <div className="flex flex-col gap-4">
      <InvariantSection
        title="Place invariants"
        invariants={invariants.place}
        truncated={invariants.placeTruncated}
        order={placeOrder}
        nameOf={placeName}
        covered={invariants.placesCovered}
        coveredNote="All places covered, so the net is structurally bounded and conservative."
        emptyNote="No place invariants."
      />
      <InvariantSection
        title="Transition invariants"
        invariants={invariants.transition}
        truncated={invariants.transitionTruncated}
        order={transitionOrder}
        nameOf={transitionName}
        covered={invariants.transitionsCovered}
        coveredNote="All transitions covered, so the net is consistent."
        emptyNote="No transition invariants."
      />
    </div>
  );
}

function InvariantSection({
  title,
  invariants,
  truncated,
  order,
  nameOf,
  covered,
  coveredNote,
  emptyNote,
}: {
  title: string;
  invariants: Invariant[];
  truncated: boolean;
  order: string[];
  nameOf: (id: string) => string;
  covered: boolean;
  coveredNote: string;
  emptyNote: string;
}): JSX.Element {
  return (
    <Section title={title}>
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
            {invariants.slice(0, DISPLAY_CAP).map((inv) => (
              // Key on the id-based support (element names can collide); display uses names.
              <li
                key={invariantKey(inv)}
                className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-slate-700 text-sm"
              >
                {formatInvariant(inv, order, nameOf)}
              </li>
            ))}
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
