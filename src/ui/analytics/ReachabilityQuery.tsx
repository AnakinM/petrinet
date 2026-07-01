import { type JSX, useEffect, useState } from "react";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { Verdict } from "@/domain/analysis/types";
import type { Marking, PetriNet } from "@/domain/types";
import { Section, StatusCard } from "@/ui/analytics/widgets";

/** The M0 marking (place id → initial tokens) — the query form's starting point. */
function markingOf(net: PetriNet): Marking {
  return Object.fromEntries(net.places.map((p) => [p.id, p.tokens]));
}

/**
 * "Is this marking reachable from M0?" — a per-place token form plus a verdict card. It seeds from M0
 * and resets whenever the net changes (so the inputs always track the current places). The check
 * builds the reachability graph on demand, so the answer is reachable / not reachable / unknown (when
 * the state cap or unboundedness cut the search short).
 */
export function ReachabilityQuery({ net }: { net: PetriNet }): JSX.Element {
  const [target, setTarget] = useState<Marking>(() => markingOf(net));
  const [result, setResult] = useState<{ verdict: Verdict; detail: string } | null>(null);

  useEffect(() => {
    setTarget(markingOf(net));
    setResult(null);
  }, [net]);

  return (
    <Section
      title="Reachability query"
      help="Test whether a specific marking (a token count per place) can be reached from the initial marking M0."
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {net.places.map((p) => (
            <label key={p.id} className="flex items-center gap-1 text-slate-600 text-xs">
              <span className="font-mono text-slate-700">{p.name}</span>
              <input
                type="number"
                min={0}
                value={target[p.id] ?? 0}
                onChange={(e) =>
                  setTarget((t) => ({
                    ...t,
                    [p.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  }))
                }
                className="w-14 rounded border border-slate-300 px-1 py-0.5 text-sm"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setResult(NetAnalysis.reachable(net, target))}
          className="self-start rounded border border-slate-300 px-2 py-0.5 font-medium text-slate-600 text-xs hover:bg-slate-100"
        >
          Check reachable
        </button>
        {result && <StatusCard title="Reachable" verdict={result.verdict} detail={result.detail} />}
      </div>
    </Section>
  );
}
