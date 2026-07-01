import { type JSX, type ReactNode, useMemo } from "react";
import { STATE_CAP_LABEL } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, Deadlock } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { Place } from "@/domain/types";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { ReachabilityQuery } from "@/ui/analytics/ReachabilityQuery";
import { DISPLAY_CAP, HighlightChip, Overflow, Section } from "@/ui/analytics/widgets";

/**
 * Structure & diagnostics: loops and net facts come from the always-on structural pass; dead
 * transitions and deadlock markings need the behavioural reachability pass, so they show a hint
 * until Re-analyze has run for the current net. Every entity is a chip that spotlights its node(s)
 * on the canvas (and pans to them); clicking the lit one again clears the highlight.
 */
export function StructureTab({ result }: { result: AnalysisResult }): JSX.Element {
  const net = useNetStore((s) => s.net);
  // A comma-joined key of the live highlight, so each chip can tell whether it is the lit one.
  const lit = useAnalyticsStore((s) => s.highlight).join(",");
  // Resolvers rebuild only when the net changes, not on every highlight-click re-render.
  const name = useMemo(() => NetNames.resolver([...net.places, ...net.transitions]), [net]);
  const placeName = useMemo(() => NetNames.resolver(net.places), [net.places]);
  const transitionName = useMemo(() => NetNames.resolver(net.transitions), [net.transitions]);
  const { diagnostics: d, exploredStates, stateSpaceExceeded, stateSpaceComplete } = result;
  const behaviouralRan = exploredStates > 0;
  const totalNodes = net.places.length + net.transitions.length;

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Loops"
        help="Cyclic structure: nodes that lie on a directed cycle, grouped by strongly-connected component."
      >
        {d.acyclic ? (
          <Note>The net is acyclic.</Note>
        ) : (
          <>
            {/* A cyclic SCC is an unordered node set — commas, not arrows (which would imply a path). */}
            <ChipList>
              {d.cyclicComponents.map((c) => (
                <HighlightChip key={c.join(",")} ids={c} lit={lit}>
                  <span className="font-mono">{c.map(name).join(", ")}</span>
                </HighlightChip>
              ))}
            </ChipList>
            <p className="text-slate-500 text-xs">
              {cycleCoverage(d.cyclicComponents, totalNodes)}
            </p>
          </>
        )}
      </Section>

      <Section
        title="Dead transitions"
        help="Transitions that can never fire from any reachable marking (needs the reachability pass)."
      >
        {!behaviouralRan ? (
          <Hint />
        ) : !stateSpaceComplete ? (
          <Note>Undetermined. The reachability graph is incomplete.</Note>
        ) : d.deadTransitions.length === 0 ? (
          <Note>None. Every transition can fire.</Note>
        ) : (
          <ChipList>
            {d.deadTransitions.slice(0, DISPLAY_CAP).map((id) => (
              <HighlightChip key={id} ids={[id]} lit={lit}>
                {transitionName(id)}
              </HighlightChip>
            ))}
            <Overflow total={d.deadTransitions.length} />
          </ChipList>
        )}
      </Section>

      <Section
        title="Deadlock markings"
        help="Reachable markings in which no transition is enabled — the net is stuck."
      >
        {!behaviouralRan ? (
          <Hint />
        ) : d.deadlocks.length > 0 ? (
          // Found deadlocks are real witnesses even on an incomplete graph, so always show them.
          <ChipList>
            {d.deadlocks.slice(0, DISPLAY_CAP).map((dl) => (
              <DeadlockRow
                key={deadlockKey(dl)}
                deadlock={dl}
                places={net.places}
                transitionName={transitionName}
                lit={lit}
              />
            ))}
            <Overflow total={d.deadlocks.length} />
          </ChipList>
        ) : stateSpaceComplete ? (
          <Note>None. No reachable marking is dead.</Note>
        ) : (
          <Note>None found in the explored markings. The graph is incomplete.</Note>
        )}
      </Section>

      <Section
        title="Net facts"
        help="Static graph facts: connectedness, and source / sink / isolated nodes by their incident arcs."
      >
        <dl className="flex flex-col gap-2 text-sm">
          <Fact label="Connected" value={d.connected ? "Yes" : "No"} />
          <FactChips label="Source places" ids={d.sourcePlaces} nameOf={placeName} lit={lit} />
          <FactChips label="Sink places" ids={d.sinkPlaces} nameOf={placeName} lit={lit} />
          <FactChips
            label="Source transitions"
            ids={d.sourceTransitions}
            nameOf={transitionName}
            lit={lit}
          />
          <FactChips
            label="Sink transitions"
            ids={d.sinkTransitions}
            nameOf={transitionName}
            lit={lit}
          />
          <FactChips label="Isolated" ids={d.isolated} nameOf={name} lit={lit} />
        </dl>
      </Section>

      {behaviouralRan && (
        <p className="text-slate-400 text-xs">
          Explored {exploredStates} marking{exploredStates === 1 ? "" : "s"}
          {stateSpaceExceeded
            ? ` (stopped at the ${STATE_CAP_LABEL} cap)`
            : stateSpaceComplete
              ? ""
              : " (incomplete because the net is unbounded)"}
          .
        </p>
      )}

      <ReachabilityQuery net={net} />
    </div>
  );
}

/** A deadlock witness; clicking spotlights the places that still hold tokens in the dead marking. */
function DeadlockRow({
  deadlock,
  places,
  transitionName,
  lit,
}: {
  deadlock: Deadlock;
  places: Place[];
  transitionName: (id: string) => string;
  lit: string;
}): JSX.Element {
  // All-zero dead markings have nothing to spotlight; HighlightChip then renders non-interactive.
  const marked = places.filter((p) => (deadlock.marking[p.id] ?? 0) > 0).map((p) => p.id);
  return (
    <HighlightChip ids={marked} lit={lit}>
      <span className="font-mono text-slate-700">
        {NetNames.formatMarking(deadlock.marking, places)}
      </span>
      {deadlock.path.length > 0 && (
        <span className="block text-slate-400 text-xs">
          via {deadlock.path.map(transitionName).join(" → ")}
        </span>
      )}
    </HighlightChip>
  );
}

function ChipList({ children }: { children: ReactNode }): JSX.Element {
  return <div className="flex flex-col gap-1">{children}</div>;
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}

/** A net-fact row whose members are individually clickable chips (or an em dash when empty). */
function FactChips({
  label,
  ids,
  nameOf,
  lit,
}: {
  label: string;
  ids: string[];
  nameOf: (id: string) => string;
  lit: string;
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      {ids.length === 0 ? (
        <dd className="text-slate-700">—</dd>
      ) : (
        <dd className="flex flex-wrap justify-end gap-1">
          {ids.map((id) => (
            <HighlightChip key={id} ids={[id]} lit={lit} size="chip">
              {nameOf(id)}
            </HighlightChip>
          ))}
        </dd>
      )}
    </div>
  );
}

function Note({ children }: { children: string }): JSX.Element {
  return <p className="text-slate-400 text-sm">{children}</p>;
}

function Hint(): JSX.Element {
  return (
    <p className="text-slate-400 text-sm">Run Re-analyze to compute behavioural diagnostics.</p>
  );
}

function deadlockKey(deadlock: Deadlock): string {
  return deadlock.path.join(",") || JSON.stringify(deadlock.marking);
}

/**
 * One-line cycle-coverage summary from the SCC decomposition: how many nodes lie on a cycle (are in
 * a strongly-connected component of size > 1) out of the whole net, and how many such components.
 */
function cycleCoverage(components: string[][], totalNodes: number): string {
  const onCycle = new Set(components.flat()).size;
  const pct = totalNodes === 0 ? 0 : Math.round((100 * onCycle) / totalNodes);
  const n = components.length;
  return `${onCycle} of ${totalNodes} node${totalNodes === 1 ? "" : "s"} (${pct}%) lie on a cycle, across ${n} cyclic component${n === 1 ? "" : "s"}.`;
}
