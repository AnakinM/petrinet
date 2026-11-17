import type { JSX } from "react";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { AnalysisResult, Deadlock, Verdict } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { Place } from "@/domain/types";
import { useNetNames } from "@/ui/analytics/useNetNames";
import {
  ChipList,
  DISPLAY_CAP,
  ElementChip,
  HighlightChip,
  Note,
  Overflow,
  PENDING_LABEL,
  SubHeading,
  VerdictCard,
} from "@/ui/analytics/widgets";

const VERDICT_WORDS: Record<Verdict, string> = { yes: "yes", no: "no", indeterminate: "unknown" };

/**
 * The net's properties, one card each. Conservative, and Bounded when a place invariant covers the
 * net, come from the instant slice. The rest need the full analysis and show "Needs the full
 * analysis" until it runs. Then they carry their evidence: the place bounds in Bounded, the
 * transitions that never fire in Live, and the deadlock markings in Deadlock-free.
 */
export function PropertiesTab({ result }: { result: AnalysisResult }): JSX.Element {
  const { boundedness, conservative, live, reversible, deadlockFree } = result;
  // The full analysis has run for this net once it has place bounds.
  const ran = result.placeBounds !== null;
  const pending = (verdict: Verdict): boolean => !ran && verdict === "indeterminate";
  return (
    <div className="flex flex-col gap-3">
      <VerdictCard
        title="Bounded"
        help="Bounded"
        verdict={boundedness.bounded}
        pending={pending(boundedness.bounded)}
        {...NetAnalysis.boundedDetail(result)}
      >
        <PlaceBoundsPart result={result} />
      </VerdictCard>
      <VerdictCard
        title="Safe"
        help="Safe"
        verdict={boundedness.safe}
        pending={pending(boundedness.safe)}
        {...NetAnalysis.safeDetail(result)}
      />
      <VerdictCard
        title="Conservative"
        help="Conservative"
        verdict={conservative.verdict}
        detail={conservative.detail}
        items={conservative.items}
      />
      <VerdictCard
        title="Live"
        help="Live"
        verdict={live.verdict}
        pending={pending(live.verdict)}
        detail={live.detail}
        items={live.items}
      >
        {ran && <NeverFiresPart result={result} />}
      </VerdictCard>
      <VerdictCard
        title="Reversible"
        help="Reversible"
        verdict={reversible.verdict}
        pending={pending(reversible.verdict)}
        detail={reversible.detail}
        items={reversible.items}
      />
      <VerdictCard
        title="Deadlock-free"
        help="Deadlock-free"
        verdict={deadlockFree.verdict}
        pending={pending(deadlockFree.verdict)}
        detail={deadlockLead(result)}
      >
        {ran && <DeadlocksPart result={result} />}
      </VerdictCard>
    </div>
  );
}

/**
 * The bound of each place, from the full analysis. On an incomplete state space the numbers are only
 * lower limits, and the card says so; a place proven to grow without limit reads "no bound".
 */
function PlaceBoundsPart({ result }: { result: AnalysisResult }): JSX.Element {
  const { net, placeName } = useNetNames();
  const bounds = result.placeBounds;
  const caveat = NetAnalysis.placeBoundsCaveat(result);
  const places = net.places.slice(0, DISPLAY_CAP);
  return (
    <div className="flex flex-col gap-1.5 border-line-subtle border-t pt-2">
      <SubHeading title="Place bounds" help="Place bounds" />
      {bounds === null ? (
        <Note>{PENDING_LABEL}</Note>
      ) : net.places.length === 0 ? (
        <p>none</p>
      ) : (
        <>
          {!bounds.exact && (
            <p className="text-warning-fg">
              These numbers are only lower limits, because the full analysis could not explore every
              marking.
            </p>
          )}
          {caveat !== null && <p className="text-warning-fg">{caveat}</p>}
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            {places.map((p) => {
              const max = bounds.max[p.id] ?? 0;
              const value = bounds.unbounded.includes(p.id)
                ? "no bound"
                : bounds.exact
                  ? String(max)
                  : `at least ${max}`;
              return (
                <div key={p.id} className="contents">
                  <dt className="min-w-0">
                    <ElementChip id={p.id} kind="place" name={placeName(p.id)} />
                  </dt>
                  <dd className="text-right font-mono">{value}</dd>
                </div>
              );
            })}
          </dl>
          <Overflow total={net.places.length} />
        </>
      )}
    </div>
  );
}

/**
 * The Live card's evidence: whether every transition can fire at least once (quasi-live), and the
 * transitions that never fire as chips. On an incomplete state space that list is undetermined.
 */
function NeverFiresPart({ result }: { result: AnalysisResult }): JSX.Element {
  const { transitionName } = useNetNames();
  const { quasiLive, stateSpaceComplete } = result;
  const dead = result.diagnostics.deadTransitions;
  return (
    <div className="flex flex-col gap-1.5 border-line-subtle border-t pt-2">
      <p>
        Quasi-live: {VERDICT_WORDS[quasiLive.verdict]}.
        {quasiLive.verdict === "indeterminate" && ` ${quasiLive.detail}`}
      </p>
      {!stateSpaceComplete ? (
        <p>Never fires: undetermined. The reachability graph is incomplete.</p>
      ) : dead.length === 0 ? (
        <p>Never fires: none.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <span>Never fires:</span>
          {dead.slice(0, DISPLAY_CAP).map((id) => (
            <ElementChip key={id} id={id} kind="transition" name={transitionName(id)} />
          ))}
          {dead.length > DISPLAY_CAP && <span>and {dead.length - DISPLAY_CAP} more.</span>}
        </div>
      )}
    </div>
  );
}

/** The Deadlock-free card's lead: the count of dead markings found, or the verdict's own reason. */
function deadlockLead(result: AnalysisResult): string {
  const n = result.diagnostics.deadlocks.length;
  if (result.deadlockFree.verdict !== "no" || n === 0) return result.deadlockFree.detail;
  return n === 1 ? "Reaches a dead marking:" : `Reaches ${n} dead markings:`;
}

/**
 * The deadlock markings that the full analysis found, each with a firing sequence that leads to it.
 * Three cases stay apart: markings found, none in a complete state space (the lead says so), and
 * none found in the explored part of an incomplete one.
 */
function DeadlocksPart({ result }: { result: AnalysisResult }): JSX.Element | null {
  const { net, transitionName } = useNetNames();
  const { deadlocks } = result.diagnostics;
  if (deadlocks.length === 0) {
    if (result.stateSpaceComplete) return null;
    return <Note>None found in the explored markings. The graph is incomplete.</Note>;
  }
  // Found deadlocks are real witnesses even on an incomplete graph, so they always show.
  return (
    <div className="flex flex-col gap-1">
      <ChipList>
        {deadlocks.slice(0, DISPLAY_CAP).map((dl) => (
          <DeadlockRow
            key={deadlockKey(dl)}
            deadlock={dl}
            places={net.places}
            transitionName={transitionName}
          />
        ))}
      </ChipList>
      <Overflow total={deadlocks.length} />
    </div>
  );
}

/** A deadlock witness; clicking spotlights the places that still hold tokens in the dead marking. */
function DeadlockRow({
  deadlock,
  places,
  transitionName,
}: {
  deadlock: Deadlock;
  places: Place[];
  transitionName: (id: string) => string;
}): JSX.Element {
  // All-zero dead markings have nothing to spotlight; HighlightChip then renders non-interactive.
  const marked = places.filter((p) => (deadlock.marking[p.id] ?? 0) > 0).map((p) => p.id);
  return (
    <HighlightChip
      target={{ nodes: marked, arcs: [] }}
      highlightKey={`deadlock:${deadlockKey(deadlock)}`}
      layout="row"
    >
      <span className="font-mono">{NetNames.formatMarking(deadlock.marking, places)}</span>
      {deadlock.path.length > 0 && (
        <span className="text-[13px] text-fg-subtle">
          via {deadlock.path.map(transitionName).join(" → ")}
        </span>
      )}
    </HighlightChip>
  );
}

function deadlockKey(deadlock: Deadlock): string {
  return deadlock.path.join(",") || JSON.stringify(deadlock.marking);
}
