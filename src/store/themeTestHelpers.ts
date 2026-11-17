import { useThemeStore } from "@/store/themeStore";

/** Test helper: puts the theme back to a fresh visit with a light system. */
export class ThemeTestHelpers {
  static reset(): void {
    localStorage.clear();
    useThemeStore.setState({ choice: null, resolved: "light" });
    document.documentElement.classList.remove("dark");
  }
}
