import type { JSX } from "react";
import { STATE_CAP_LABEL } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, Deadlock } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { Marking, Place } from "@/domain/types";
import { useNetStore } from "@/store/netStore";

/**
 * Structure & diagnostics: loops and net facts come from the always-on structural pass; dead
 * transitions and deadlock markings need the behavioural reachability pass, so they show a hint
 * until Re-analyze has run for the current net.
 */
export function StructureTab({ result }: { result: AnalysisResult }): JSX.Element {
  const net = useNetStore((s) => s.net);
  const name = NetNames.resolver([...net.places, ...net.transitions]);
  const placeName = NetNames.resolver(net.places);
  const transitionName = NetNames.resolver(net.transitions);
  const { diagnostics: d, exploredStates, stateSpaceExceeded, stateSpaceComplete } = result;
  const behaviouralRan = exploredStates > 0;

  return (
    <div className="flex flex-col gap-4">
      <Section title="Loops">
        {d.acyclic ? (
          <Note>The net is acyclic.</Note>
        ) : (
          // A cyclic SCC is an unordered node set — commas, not arrows (which would imply a path).
          <List
            items={d.cyclicComponents.map((c) => ({
              key: c.join(","),
              label: c.map(name).join(", "),
            }))}
            mono
          />
        )}
      </Section>

      <Section title="Dead transitions">
        {!behaviouralRan ? (
          <Hint />
        ) : !stateSpaceComplete ? (
          <Note>Undetermined — the reachability graph is incomplete.</Note>
        ) : d.deadTransitions.length === 0 ? (
          <Note>None — every transition can fire.</Note>
        ) : (
          <List items={d.deadTransitions.map((id) => ({ key: id, label: transitionName(id) }))} />
        )}
      </Section>

      <Section title="Deadlock markings">
        {!behaviouralRan ? (
          <Hint />
        ) : d.deadlocks.length > 0 ? (
          // Found deadlocks are real witnesses even on an incomplete graph, so always show them.
          <ul className="flex flex-col gap-1">
            {d.deadlocks.map((dl) => (
              <DeadlockRow
                key={deadlockKey(dl)}
                deadlock={dl}
                places={net.places}
                transitionName={transitionName}
              />
            ))}
          </ul>
        ) : stateSpaceComplete ? (
          <Note>None — no reachable marking is dead.</Note>
        ) : (
          <Note>None found in the explored markings — the graph is incomplete.</Note>
        )}
      </Section>

      <Section title="Net facts">
        <dl className="flex flex-col gap-1 text-sm">
          <Fact label="Connected" value={d.connected ? "Yes" : "No"} />
          <Fact label="Source places" value={join(d.sourcePlaces, placeName)} />
          <Fact label="Sink places" value={join(d.sinkPlaces, placeName)} />
          <Fact label="Source transitions" value={join(d.sourceTransitions, transitionName)} />
          <Fact label="Sink transitions" value={join(d.sinkTransitions, transitionName)} />
          <Fact label="Isolated" value={join(d.isolated, name)} />
        </dl>
      </Section>

      {behaviouralRan && (
        <p className="text-slate-400 text-xs">
          Explored {exploredStates} marking{exploredStates === 1 ? "" : "s"}
          {stateSpaceExceeded
            ? ` (stopped at the ${STATE_CAP_LABEL} cap)`
            : stateSpaceComplete
              ? ""
              : " (incomplete — the net is unbounded)"}
          .
        </p>
      )}
    </div>
  );
}

function DeadlockRow({
  deadlock,
  places,
  transitionName,
}: {
  deadlock: Deadlock;
  places: Place[];
  transitionName: (id: string) => string;
}): JSX.Element {
  return (
    <li className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm">
      <span className="font-mono text-slate-700">{formatMarking(deadlock.marking, places)}</span>
      {deadlock.path.length > 0 && (
        <span className="block text-slate-400 text-xs">
          via {deadlock.path.map(transitionName).join(" → ")}
        </span>
      )}
    </li>
  );
}

function Section({ title, children }: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">{title}</h3>
      {children}
    </section>
  );
}

/** Rows keyed by a stable, unique id (element ids never collide; display names can). */
function List({
  items,
  mono,
}: {
  items: { key: string; label: string }[];
  mono?: boolean;
}): JSX.Element {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ key, label }) => (
        <li
          key={key}
          className={`rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700 text-sm ${mono ? "font-mono" : ""}`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
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

/** Render a marking as `P1=0, P3=1` over place names, in net order. */
function formatMarking(marking: Marking, places: Place[]): string {
  return places.map((p) => `${p.name}=${marking[p.id] ?? 0}`).join(", ");
}

function deadlockKey(deadlock: Deadlock): string {
  return deadlock.path.join(",") || JSON.stringify(deadlock.marking);
}

function join(ids: string[], nameOf: (id: string) => string): string {
  return ids.length === 0 ? "—" : ids.map(nameOf).join(", ");
}
