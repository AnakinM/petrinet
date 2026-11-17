import type { JSX, ReactNode } from "react";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useBuildStore } from "@/store/buildStore";
import { netHistory, useNetStore, useTemporal } from "@/store/netStore";
import {
  ExportIcon,
  ImageIcon,
  ImportIcon,
  MagnetIcon,
  NewIcon,
  RedoIcon,
  UndoIcon,
} from "@/ui/icons";
import { Menu, type MenuEntry, type MenuTriggerProps } from "@/ui/Menu";
import { ModeToggle } from "@/ui/ModeToggle";
import { Tooltip, type TooltipTriggerProps } from "@/ui/Tooltip";
import { EXPORT_ENTRIES, IMAGE_ENTRIES, importNet, newNet } from "@/ui/toolbarActions";
import { useThemeToggle } from "@/ui/useThemeToggle";

const SNAP_ON_TIP = "Snap to grid: on. Click to turn off.";
const SNAP_OFF_TIP = "Snap to grid: off. Click to turn on.";
const EXPORT_TIP = "Save the net as a file that can be imported again";
const IMAGE_TIP = "Save or copy a picture of the net";

/**
 * Top bar: New / Import, the Export and Image menus, undo / redo, the theme switch, the Analysis
 * toggle and the Build ↔ Simulate toggle.
 */
export function Toolbar(): JSX.Element {
  const mode = useNetStore((s) => s.mode);
  const simulating = mode === "simulate";
  const analyticsOpen = useAnalyticsStore((s) => s.open);
  const snap = useBuildStore((s) => s.snap);
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);
  const theme = useThemeToggle();

  return (
    <header className="relative z-20 flex items-center gap-2 border-line-strong border-b-[3px] bg-surface px-3 py-2 shadow-[0_4px_8px_-4px_var(--color-shadow)]">
      <div className="mr-2 flex items-center gap-1.5">
        <img src="/apple-touch-icon.png" alt="" width={24} height={24} className="h-6 w-6" />
        {/* The site name is the page heading. "Editor" shows from 1280 pixels up only, so the bar
            is no wider than before on a narrow window. Screen readers and crawlers always get it. */}
        <h1 className="whitespace-nowrap font-semibold text-fg text-sm">
          PetriNet <span className="sr-only xl:not-sr-only">Editor</span>
        </h1>
      </div>
      <ToolbarButton onClick={newNet} disabled={simulating}>
        <NewIcon />
        New
      </ToolbarButton>
      <ToolbarButton onClick={importNet} disabled={simulating}>
        <ImportIcon />
        Import
      </ToolbarButton>
      <ToolbarMenu entries={EXPORT_ENTRIES} tooltip={EXPORT_TIP}>
        <ExportIcon />
        Export
      </ToolbarMenu>
      <ToolbarMenu entries={IMAGE_ENTRIES} tooltip={IMAGE_TIP}>
        <ImageIcon />
        Image
      </ToolbarMenu>
      <span className="mx-1 h-5 w-px bg-line" />
      <ToolbarButton onClick={netHistory.undo} disabled={simulating || !canUndo}>
        <UndoIcon />
        Undo
      </ToolbarButton>
      <ToolbarButton onClick={netHistory.redo} disabled={simulating || !canRedo}>
        <RedoIcon />
        Redo
      </ToolbarButton>
      {!simulating && (
        <>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolbarButton
            onClick={() => useBuildStore.getState().toggleSnap()}
            active={snap}
            ariaLabel="Snap to grid"
            tooltip={snap ? SNAP_ON_TIP : SNAP_OFF_TIP}
          >
            {snap ? (
              <MagnetIcon />
            ) : (
              <span className="flex text-fg-faint">
                <MagnetIcon off />
              </span>
            )}
          </ToolbarButton>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ToolbarButton onClick={theme.toggle} ariaLabel={theme.label} tooltip={theme.label}>
          {theme.icon}
        </ToolbarButton>
        <ToolbarButton onClick={() => useAnalyticsStore.getState().toggle()} active={analyticsOpen}>
          Analysis
        </ToolbarButton>
        <ModeToggle mode={mode} />
      </div>
    </header>
  );
}

/** A top bar button that opens a {@link Menu} of `entries` under it. */
function ToolbarMenu({
  entries,
  tooltip,
  children,
}: {
  entries: MenuEntry[];
  tooltip: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <Menu sections={[{ entries }]}>
      {(trigger, open) => (
        <ToolbarButton menu={trigger} active={open} tooltip={tooltip} tooltipSuppressed={open}>
          {children}
        </ToolbarButton>
      )}
    </Menu>
  );
}

/**
 * A top bar button. A `tooltip` shows as a quick {@link Tooltip} under it; `tooltipSuppressed`
 * keeps it hidden while the button's own menu is open there. `menu` makes it the trigger of a
 * {@link Menu}: the menu then handles the click, and `active` only styles the open state.
 *
 * `min-h-7.5` (1.875rem) is the height of a button with a text label (`text-sm`, `py-1`, a border),
 * so icon-only buttons are as tall. If that padding changes, change `min-h-7.5` with it.
 */
function ToolbarButton({
  onClick,
  menu,
  disabled,
  active,
  tooltip,
  tooltipSuppressed,
  ariaLabel,
  children,
}: {
  onClick?: () => void;
  menu?: MenuTriggerProps;
  disabled?: boolean;
  active?: boolean;
  tooltip?: string;
  tooltipSuppressed?: boolean;
  ariaLabel?: string;
  children: ReactNode;
}): JSX.Element {
  const button = (trigger?: TooltipTriggerProps): JSX.Element => (
    <button
      type="button"
      {...trigger}
      onClick={onClick}
      {...menu}
      disabled={disabled}
      aria-pressed={menu ? undefined : active}
      aria-label={ariaLabel}
      className={
        active
          ? "inline-flex min-h-7.5 items-center gap-1.5 rounded border border-accent bg-accent px-2.5 py-1 text-on-accent text-sm shadow-sm"
          : "inline-flex min-h-7.5 items-center gap-1.5 rounded border border-line-strong bg-surface-raised px-2.5 py-1 text-fg-soft text-sm shadow-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip label={tooltip} suppressed={tooltipSuppressed}>
      {button}
    </Tooltip>
  ) : (
    button()
  );
}
