import { type JSX, useEffect, useState } from "react";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
import type { Verdict } from "@/domain/analysis/types";
import type { Marking, PetriNet } from "@/domain/types";
import { Card, VerdictBadge } from "@/ui/analytics/widgets";

/** The M0 marking (place id → initial tokens): the query form's starting point. */
function markingOf(net: PetriNet): Marking {
  return Object.fromEntries(net.places.map((p) => [p.id, p.tokens]));
}

/**
 * "Is this marking reachable from M0?": a per-place token form plus a verdict. It seeds from M0
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
    <Card title="Reachability query" help="Reachability query">
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {net.places.map((p) => (
          <label key={p.id} className="flex items-center gap-1.5">
            <span className="font-mono">{p.name}</span>
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
              className="w-16 rounded border border-line-strong px-1.5 py-0.5 text-base"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setResult(NetAnalysis.reachable(net, target))}
        className="self-start rounded border border-line-strong bg-surface-raised px-2.5 py-1 font-medium text-fg-soft text-sm hover:bg-surface-muted"
      >
        Check reachable
      </button>
      {result && (
        <div className="flex items-start gap-2">
          <VerdictBadge verdict={result.verdict} />
          <p className="pt-0.5">{result.detail}</p>
        </div>
      )}
    </Card>
  );
}
