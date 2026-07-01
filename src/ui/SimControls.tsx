import { type JSX, type ReactNode, useEffect } from "react";
import { AUTO_RUN_SPEEDS, useSimStore } from "@/store/simStore";
import { PauseIcon, PlayIcon, StepIcon } from "@/ui/icons";

/**
 * Simulate-mode transport, pinned at the top of the left sidebar (the Simulate-mode counterpart to
 * the Build-mode {@link Palette}). Play/Pause auto-runs, Step fires one transition, Reset returns to
 * M0, and the selector sets the auto-run rate.
 *
 * The firing timer lives here as a mounted-only effect: the panel is rendered only in Simulate, so
 * leaving Simulate unmounts it and tears the interval down. While `playing`, it ticks `step` every
 * (1000 / speed) ms; the pure engine does the actual firing. `step()` clears `playing` itself once it
 * reaches a dead marking, and that re-render removes the interval via this effect's cleanup.
 */
export function SimControls(): JSX.Element {
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const canFire = useSimStore((s) => s.enabled.size > 0);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => useSimStore.getState().step(), 1000 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  return (
    <section className="flex flex-col gap-3 p-3">
      <h2 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Simulation</h2>
      <PrimaryButton
        onClick={() => (playing ? useSimStore.getState().pause() : useSimStore.getState().play())}
        disabled={!playing && !canFire}
        title={playing ? "Pause auto-run" : "Auto-run: fire a random enabled transition each tick"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
        {playing ? "Pause" : "Play"}
      </PrimaryButton>
      <div className="grid grid-cols-2 gap-2">
        <SecondaryButton
          onClick={() => useSimStore.getState().step()}
          disabled={!canFire}
          title="Fire one random enabled transition"
        >
          <StepIcon />
          Step
        </SecondaryButton>
        <SecondaryButton
          onClick={() => useSimStore.getState().reset()}
          title="Return to the initial marking M0"
        >
          Reset
        </SecondaryButton>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs">Speed</span>
        <select
          value={speed}
          onChange={(e) => useSimStore.getState().setSpeed(Number(e.target.value))}
          aria-label="Auto-run speed"
          title="Auto-run speed (transitions per second)"
          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-slate-700 text-sm"
        >
          {AUTO_RUN_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}/s
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

/** The prominent Play/Pause action: full-width, filled slate, dims to a flat disc when idle. */
function PrimaryButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center gap-2 rounded border border-slate-700 bg-slate-700 px-3 py-2 text-sm text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
    >
      {children}
    </button>
  );
}

/** A Step / Reset secondary action: white, matching the sidebar's other outlined buttons. */
function SecondaryButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-2 text-slate-700 text-sm shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
