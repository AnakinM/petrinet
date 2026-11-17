import type { JSX, ReactNode } from "react";
import { type ThemePreference, useThemeStore } from "@/store/themeStore";
import { MonitorIcon, MoonIcon, SunIcon } from "@/ui/icons";
import { Menu, type MenuEntry, type MenuTriggerProps } from "@/ui/Menu";

/** The tooltip and the accessible name of the theme button. */
export const THEME_LABEL = "Theme";

const CHOICES: readonly { preference: ThemePreference; label: string }[] = [
  { preference: "system", label: "System" },
  { preference: "light", label: "Light" },
  { preference: "dark", label: "Dark" },
];

/** The three theme choices as {@link Menu} entries, with a check mark on the current one. */
export function useThemeEntries(): MenuEntry[] {
  const preference = useThemeStore((s) => s.preference);
  return CHOICES.map((choice) => ({
    label: choice.label,
    selected: choice.preference === preference,
    onSelect: () => useThemeStore.getState().setPreference(choice.preference),
  }));
}

/** The icon of the current choice: a monitor for System, a sun for Light, a moon for Dark. */
export function ThemeIcon(): JSX.Element {
  const preference = useThemeStore((s) => s.preference);
  if (preference === "light") return <SunIcon />;
  if (preference === "dark") return <MoonIcon />;
  return <MonitorIcon />;
}

/**
 * The theme switch: a {@link Menu} with System, Light and Dark. `children` renders the trigger
 * button, as with `Menu`, so each place styles it like its neighbours; put {@link ThemeIcon} in it.
 */
export function ThemeMenu({
  children,
}: {
  children: (trigger: MenuTriggerProps, open: boolean) => ReactNode;
}): JSX.Element {
  const entries = useThemeEntries();
  return (
    <Menu sections={[{ entries }]} align="end">
      {children}
    </Menu>
  );
}
