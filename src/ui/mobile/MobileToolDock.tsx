import { useReactFlow } from "@xyflow/react";
import type { JSX, ReactNode } from "react";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";
import { AUTO_RUN_SPEEDS, useSimStore } from "@/store/simStore";
import { TOOLS } from "@/ui/buildTools";
import { FitViewIcon, PauseIcon, PlayIcon, StepIcon } from "@/ui/icons";
import { useAutoRunTimer } from "@/ui/useAutoRunTimer";

// The marquee "select" tool is a desktop drag gesture; on mobile you select by tapping in idle,
// so the dock offers an explicit Select/Move (idle) button instead and drops the marquee tool.
const DOCK_TOOLS = TOOLS.filter((t) => t.id !== "select");

/**
 * Bottom tool dock: the thumb-zone replacement for the desktop left sidebar's Palette / SimControls
 * and the canvas zoom controls. In Build it holds Select-Move plus the place/transition/arc/token
 * tools (from the shared {@link TOOLS}); in Simulate it holds the transport; both end with Fit-view.
 * Sits in the mobile shell inside the React Flow provider so Fit can drive the viewport.
 */
export function MobileToolDock(): JSX.Element {
  const simulating = useNetStore((s) => s.mode === "simulate");
  return (
    <div className="pointer-events-auto border-slate-300 border-t-[3px] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_8px_-4px_rgba(15,23,42,0.15)] backdrop-blur">
      <div className="flex items-stretch gap-1 px-2 py-2">
        {simulating ? <SimDock /> : <BuildDock />}
      </div>
    </div>
  );
}

function BuildDock(): JSX.Element {
  const tool = useBuildStore((s) => s.tool);
  return (
    <>
      <DockButton
        active={tool === "idle"}
        label="Select"
        onClick={() => useBuildStore.getState().setTool("idle")}
      >
        <CursorSwatch />
      </DockButton>
      {DOCK_TOOLS.map((t) => (
        <DockButton
          key={t.id}
          active={tool === t.id}
          label={t.label}
          onClick={() => useBuildStore.getState().toggleTool(t.id)}
        >
          {t.swatch}
        </DockButton>
      ))}
      <FitButton />
    </>
  );
}

function SimDock(): JSX.Element {
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const canFire = useSimStore((s) => s.enabled.size > 0);
  useAutoRunTimer();

  return (
    <>
      <DockButton
        active={playing}
        disabled={!playing && !canFire}
        label={playing ? "Pause" : "Play"}
        onClick={() => (playing ? useSimStore.getState().pause() : useSimStore.getState().play())}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </DockButton>
      <DockButton label="Step" disabled={!canFire} onClick={() => useSimStore.getState().step()}>
        <StepIcon />
      </DockButton>
      <DockButton label="Reset" onClick={() => useSimStore.getState().reset()}>
        <ResetSwatch />
      </DockButton>
      <label className="flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 font-medium text-[10px] text-slate-500">
        Speed
        <select
          value={speed}
          onChange={(e) => useSimStore.getState().setSpeed(Number(e.target.value))}
          aria-label="Auto-run speed"
          className="rounded border border-slate-300 bg-white px-1 py-1 text-slate-700 text-sm"
        >
          {AUTO_RUN_SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}/s
            </option>
          ))}
        </select>
      </label>
      <FitButton />
    </>
  );
}

/** Fit the whole net into view: the mobile stand-in for the hidden zoom controls. */
function FitButton(): JSX.Element {
  const { fitView } = useReactFlow();
  return (
    <DockButton label="Fit" onClick={() => fitView({ duration: 300, padding: 0.2 })}>
      <FitViewIcon />
    </DockButton>
  );
}

/** A dock cell: a stacked icon + tiny label, filling an equal share of the row, sized for a thumb. */
function DockButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={label}
      className={`flex min-w-0 flex-1 touch-manipulation flex-col items-center gap-1 rounded px-1 py-1.5 font-medium text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-slate-700 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="flex h-6 items-center justify-center">{children}</span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** A pointer arrow: the Select / move (idle) tool. */
function CursorSwatch(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 3l7 17 2.5-6.5L20 11z" />
    </svg>
  );
}

/** A circular arrow: return the simulation to M0. */
function ResetSwatch(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}
