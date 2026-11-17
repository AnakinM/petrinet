import type { JSX } from "react";
import { useThemeStore } from "@/store/themeStore";
import { MoonIcon, SunIcon } from "@/ui/icons";

/** What the theme button is, for the current look: its label, its icon and its click. */
export interface ThemeToggle {
  /** The tooltip and the accessible name: what a click does. */
  label: string;
  /** The icon of the look a click switches to: a moon on the light look, a sun on the dark one. */
  icon: JSX.Element;
  toggle: () => void;
}

/** The theme button for the look that is on screen. */
export function useThemeToggle(): ThemeToggle {
  const dark = useThemeStore((s) => s.resolved) === "dark";
  return {
    label: dark ? "Switch to light theme" : "Switch to dark theme",
    icon: dark ? <SunIcon /> : <MoonIcon />,
    toggle: () => useThemeStore.getState().toggle(),
  };
}
