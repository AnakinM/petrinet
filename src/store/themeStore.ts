import { create, type StoreApi } from "zustand";
import { SafeStorage } from "@/lib/safeStorage";

/** The visitor's choice. `system` follows the computer's light or dark setting. */
export type ThemePreference = "system" | "light" | "dark";

/** The look that is on screen. */
export type ResolvedTheme = "light" | "dark";

/**
 * The `localStorage` key of a Light or Dark choice. System is stored as no key at all. The inline
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
  preference: ThemePreference;
  resolved: ResolvedTheme;

  /** Choose a look. Light and Dark are remembered for later visits; System forgets the choice. */
  setPreference: (preference: ThemePreference) => void;
}

/**
 * The browser around the theme: the stored choice, the system setting and the page. Every access
 * is guarded, because the store also loads where there is no browser (the build's pre-render of
 * the guide, node unit tests) and because `localStorage` can be missing or throw (private modes,
 * blocked site data). Without storage the app follows the system and nothing breaks.
 */
export class ThemeEnvironment {
  /** The stored choice, or `system` when nothing usable is stored. */
  static readPreference(): ThemePreference {
    const stored = SafeStorage.get(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  }

  /** Remember Light or Dark; for System remove the key. */
  static writePreference(preference: ThemePreference): void {
    if (preference === "system") SafeStorage.remove(THEME_STORAGE_KEY);
    else SafeStorage.set(THEME_STORAGE_KEY, preference);
  }

  /** The system setting as a live query, or `null` where there is no `matchMedia`. */
  static darkQuery(): MediaQueryList | null {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(DARK_QUERY);
  }

  static resolve(preference: ThemePreference): ResolvedTheme {
    if (preference !== "system") return preference;
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
   * Load the stored choice into `store`, and follow the system setting while it is on System.
   * The store lives as long as the page, so the change listener is never removed.
   */
  static attach(store: StoreApi<ThemeState>): void {
    const preference = ThemeEnvironment.readPreference();
    const resolved = ThemeEnvironment.resolve(preference);
    ThemeEnvironment.apply(resolved);
    store.setState({ preference, resolved });

    ThemeEnvironment.darkQuery()?.addEventListener("change", (e) => {
      if (store.getState().preference !== "system") return;
      const changed: ResolvedTheme = e.matches ? "dark" : "light";
      ThemeEnvironment.apply(changed);
      store.setState({ resolved: changed });
    });
  }
}

/**
 * The theme: the visitor's {@link ThemePreference} and the {@link ResolvedTheme} on screen.
 *
 * The store is created with the neutral state that the build's pre-render sees (System, Light),
 * and the stored choice is set right after. Zustand hands that first state to React as the server
 * snapshot, so the hydration of the pre-built guide matches its HTML; React then re-renders with
 * the real state. The page colours themselves never wait for React: the inline script in
 * `index.html` set the class before the first paint.
 */
export const useThemeStore = create<ThemeState>()((set) => ({
  preference: "system",
  resolved: "light",
  setPreference: (preference) => {
    ThemeEnvironment.writePreference(preference);
    const resolved = ThemeEnvironment.resolve(preference);
    ThemeEnvironment.apply(resolved);
    set({ preference, resolved });
  },
}));

// Load the stored choice and follow the system setting. Module-scope so it is always on.
ThemeEnvironment.attach(useThemeStore);
