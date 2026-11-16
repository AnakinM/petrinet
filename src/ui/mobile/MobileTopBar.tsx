import type { JSX, ReactNode } from "react";
import { Analytics } from "@/lib/analytics";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { netHistory, useNetStore, useTemporal } from "@/store/netStore";
import { MenuIcon, RedoIcon, UndoIcon } from "@/ui/icons";
import { Menu, type MenuSection, type MenuTriggerProps } from "@/ui/Menu";
import { ModeToggle } from "@/ui/ModeToggle";
import { EXPORT_ENTRIES, IMAGE_ENTRIES, importNet, newNet } from "@/ui/toolbarActions";

const GUIDE_URL = "/guide";
const REPO_URL = "https://github.com/AnakinM/petrinet";
const NEW_ISSUE_URL = "https://github.com/AnakinM/petrinet/issues/new";

/**
 * Condensed top bar for the mobile shell: icon-only Undo/Redo (Build only), the Build↔Simulate
 * {@link ModeToggle}, and a hamburger menu holding the secondary actions that live in the desktop
 * toolbar and sidebar footer (the Export and Image groups, the Analysis toggle, and the
 * Guide/GitHub links). All actions come from the shared {@link EXPORT_ENTRIES} et al., so they match
 * the desktop.
 */
export function MobileTopBar(): JSX.Element {
  const mode = useNetStore((s) => s.mode);
  const simulating = mode === "simulate";
  const canUndo = useTemporal((t) => t.pastStates.length > 0);
  const canRedo = useTemporal((t) => t.futureStates.length > 0);

  return (
    <header className="relative z-40 flex items-center gap-1.5 border-slate-300 border-b-[3px] bg-white px-2 py-1.5 shadow-[0_4px_8px_-4px_rgba(15,23,42,0.15)]">
      <img
        src="/apple-touch-icon.png"
        alt=""
        width={26}
        height={26}
        className="h-[26px] w-[26px]"
      />
      {/* The site name is the page heading. "Editor" shows from 640 pixels up only: a phone's bar
          has no room for it. Screen readers and crawlers always get it. */}
      <h1 className="whitespace-nowrap font-semibold text-slate-800 text-sm">
        PetriNet <span className="sr-only sm:not-sr-only">Editor</span>
      </h1>
      {!simulating && (
        <>
          <IconButton onClick={netHistory.undo} disabled={!canUndo} label="Undo">
            <UndoIcon />
          </IconButton>
          <IconButton onClick={netHistory.redo} disabled={!canRedo} label="Redo">
            <RedoIcon />
          </IconButton>
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5">
        <ModeToggle mode={mode} />
        <HamburgerMenu simulating={simulating} />
      </div>
    </header>
  );
}

/** The hamburger {@link Menu}: the desktop top bar's actions in groups, then the links. */
function HamburgerMenu({ simulating }: { simulating: boolean }): JSX.Element {
  const analyticsOpen = useAnalyticsStore((s) => s.open);
  const sections: MenuSection[] = [
    {
      entries: [
        { label: "New", onSelect: newNet, disabled: simulating },
        { label: "Import…", onSelect: importNet, disabled: simulating },
      ],
    },
    { label: "Export", entries: EXPORT_ENTRIES },
    { label: "Image", entries: IMAGE_ENTRIES },
    {
      entries: [
        {
          label: analyticsOpen ? "Hide analysis" : "Show analysis",
          onSelect: () => useAnalyticsStore.getState().toggle(),
        },
      ],
    },
    {
      entries: [
        { label: "Guide", href: GUIDE_URL },
        {
          label: "GitHub",
          href: REPO_URL,
          onSelect: () => Analytics.track("Outbound link", { target: "github" }),
        },
        {
          label: "Report an issue",
          href: NEW_ISSUE_URL,
          onSelect: () => Analytics.track("Outbound link", { target: "issue" }),
        },
      ],
    },
  ];

  return (
    <Menu sections={sections} align="end">
      {(trigger, open) => (
        <IconButton menu={trigger} active={open} label="Menu">
          <MenuIcon />
        </IconButton>
      )}
    </Menu>
  );
}

/**
 * A square icon-only top-bar button, sized for a comfortable touch target. `menu` makes it the
 * trigger of a {@link Menu}: the menu then handles the click, and `active` only styles the open state.
 */
function IconButton({
  onClick,
  menu,
  disabled,
  active,
  label,
  children,
}: {
  onClick?: () => void;
  menu?: MenuTriggerProps;
  disabled?: boolean;
  active?: boolean;
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      {...menu}
      disabled={disabled}
      aria-pressed={menu ? undefined : active}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded border shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-slate-700 bg-slate-700 text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
