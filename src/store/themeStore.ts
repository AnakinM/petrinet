import { create, type StoreApi } from "zustand";
import { SafeStorage } from "@/lib/safeStorage";

/** The look that is on screen, and the two looks a visitor can choose. */
export type ResolvedTheme = "light" | "dark";

/**
 * The `localStorage` key of the visitor's choice. No key means no choice yet, and the app follows
 * the system. An old value `system`, saved by an earlier version, counts as no choice. The inline
 * script in `index.html` reads the same key before the first paint, and a test keeps them equal.
 */
export const THEME_STORAGE_KEY = "petrinet:theme";

/** The media query of the computer's dark setting. The inline script in `index.html` uses it too. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * `<meta name="theme-color">` per look: the colour of the top bar (`--color-surface`), so a phone's
 * browser bar matches it. The inline script in `index.html` uses the same values.
 */
export const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: "#ffffff",
  dark: "#0f172a",
};

export interface ThemeState {
  /** The look the visitor chose by clicking the theme button, or `null` to follow the system. */
  choice: ResolvedTheme | null;
  resolved: ResolvedTheme;

  /** Switch to the other look and remember it for later visits. */
  toggle: () => void;
}

/**
 * The browser around the theme: the stored choice, the system setting and the page. Every access
 * is guarded, because the store also loads where there is no browser (the build's pre-render of
 * the guide, node unit tests) and because `localStorage` can be missing or throw (private modes,
 * blocked site data). Without storage the app follows the system and nothing breaks.
 */
export class ThemeEnvironment {
  /** The stored choice, or `null` when nothing usable is stored. */
  static readChoice(): ResolvedTheme | null {
    const stored = SafeStorage.get(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  }

  static writeChoice(choice: ResolvedTheme): void {
    SafeStorage.set(THEME_STORAGE_KEY, choice);
  }

  /** The system setting as a live query, or `null` where there is no `matchMedia`. */
  static darkQuery(): MediaQueryList | null {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(DARK_QUERY);
  }

  /** The look for `choice`; with no choice, the system setting. */
  static resolve(choice: ResolvedTheme | null): ResolvedTheme {
    if (choice !== null) return choice;
    return ThemeEnvironment.darkQuery()?.matches === true ? "dark" : "light";
  }

  /** Put `theme` on the page: the `dark` class on `<html>`, `color-scheme` and the theme colour. */
  static apply(theme: ResolvedTheme): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLORS[theme]);
  }

  /**
   * Load the stored choice into `store`, and follow the system setting while there is no choice.
   * The store lives as long as the page, so the change listener is never removed.
   */
  static attach(store: StoreApi<ThemeState>): void {
    const choice = ThemeEnvironment.readChoice();
    const resolved = ThemeEnvironment.resolve(choice);
    ThemeEnvironment.apply(resolved);
    store.setState({ choice, resolved });

    ThemeEnvironment.darkQuery()?.addEventListener("change", (e) => {
      if (store.getState().choice !== null) return;
      const changed: ResolvedTheme = e.matches ? "dark" : "light";
      ThemeEnvironment.apply(changed);
      store.setState({ resolved: changed });
    });
  }
}

/**
 * The theme: the visitor's choice and the {@link ResolvedTheme} on screen.
 *
 * The store is created with the neutral state that the build's pre-render sees (no choice, light),
 * and the stored choice is set right after. Zustand hands that first state to React as the server
 * snapshot, so the hydration of the pre-built guide matches its HTML; React then re-renders with
 * the real state. The page colours themselves never wait for React: the inline script in
 * `index.html` set the class before the first paint.
 */
export const useThemeStore = create<ThemeState>()((set, get) => ({
  choice: null,
  resolved: "light",
  toggle: () => {
    const choice: ResolvedTheme = get().resolved === "dark" ? "light" : "dark";
    ThemeEnvironment.writeChoice(choice);
    ThemeEnvironment.apply(choice);
    set({ choice, resolved: choice });
  },
}));

// Load the stored choice and follow the system setting. Module-scope so it is always on.
ThemeEnvironment.attach(useThemeStore);
