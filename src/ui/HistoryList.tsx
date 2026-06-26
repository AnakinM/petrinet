import { type JSX, useEffect, useRef } from "react";
import { NetNames } from "@/domain/netNames";
import { useNetStore } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";

/** Past (before the cursor), the current marking, or the rewound future (after the cursor). */
type RowState = "past" | "current" | "future";

function rowState(index: number, cursor: number): RowState {
  if (index === cursor) return "current";
  return index < cursor ? "past" : "future";
}

/**
 * Simulate-mode firing log with scrub. "Initial (M0)" sits at the top, then one row per fired
 * transition (oldest→newest, labeled `T1: P1 → P2`). The row at the cursor is current; rows after
 * it are the rewound future — dimmed but still clickable to move forward again. Clicking a row
 * restores the marking recorded after that step; firing from a rewound point discards the future.
 */
export function HistoryList(): JSX.Element {
  const net = useNetStore((s) => s.net);
  const steps = useSimStore((s) => s.history.steps);
  const cursor = useSimStore((s) => s.history.cursor);
  const goto = useSimStore((s) => s.goto);
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the latest step in view when we're at the head (a fresh firing), but don't yank the
  // scroll position while the user is scrubbing back through earlier states.
  useEffect(() => {
    if (cursor === steps.length - 1) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [steps, cursor]);

  return (
    <div className="flex flex-col gap-1">
      <HistoryRow label="Initial (M0)" state={rowState(-1, cursor)} onClick={() => goto(-1)} />
      {steps.map((step, i) => (
        <HistoryRow
          // biome-ignore lint/suspicious/noArrayIndexKey: a step's index is its identity in the timeline; the row is stateless.
          key={i}
          label={NetNames.describeFiring(net, step.firedId)}
          state={rowState(i, cursor)}
          onClick={() => goto(i)}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function HistoryRow({
  label,
  state,
  onClick,
}: {
  label: string;
  state: RowState;
  onClick: () => void;
}): JSX.Element {
  const tone =
    state === "current"
      ? "bg-slate-700 text-white"
      : state === "future"
        ? "text-slate-400 hover:bg-slate-100"
        : "text-slate-700 hover:bg-slate-100";
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`w-full truncate rounded px-2 py-1 text-left text-sm transition-colors ${tone}`}
    >
      {label}
    </button>
  );
}
