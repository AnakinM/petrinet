import type { JSX } from "react";
import type { Mode } from "@/store/netStore";
import { enterBuild, enterSimulate } from "@/ui/toolbarActions";

/** The Build ↔ Simulate segmented toggle, shared by the desktop toolbar and the mobile top bar. */
export function ModeToggle({ mode }: { mode: Mode }): JSX.Element {
  return (
    <div className="flex overflow-hidden rounded border border-line-strong text-sm">
      <ModeTab active={mode === "build"} onClick={enterBuild}>
        Build
      </ModeTab>
      <ModeTab active={mode === "simulate"} onClick={enterSimulate}>
        Simulate
      </ModeTab>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "bg-accent px-3 py-1 text-on-accent"
          : "bg-surface-raised px-3 py-1 text-fg-soft hover:bg-surface-hover"
      }
    >
      {children}
    </button>
  );
}
