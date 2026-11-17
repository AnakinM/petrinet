// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedTheme } from "@/store/themeStore";

type ThemeModule = typeof import("@/store/themeStore");

/** A stand-in for the system's dark setting that a test can switch. */
class FakeDarkQuery {
  matches: boolean;
  private readonly _listeners = new Set<(e: { matches: boolean }) => void>();

  constructor(matches: boolean) {
    this.matches = matches;
  }

  addEventListener(_type: "change", listener: (e: { matches: boolean }) => void): void {
    this._listeners.add(listener);
  }

  removeEventListener(_type: "change", listener: (e: { matches: boolean }) => void): void {
    this._listeners.delete(listener);
  }

  /** The visitor changes the computer's setting. */
  change(matches: boolean): void {
    this.matches = matches;
    for (const listener of this._listeners) listener({ matches });
  }
}

const STORAGE = globalThis.localStorage;
const KEY = "petrinet:theme";

/** The system is dark (`true`) or light, and the store module loads fresh, as on a page load. */
async function load(systemDark: boolean): Promise<{ theme: ThemeModule; system: FakeDarkQuery }> {
  const system = new FakeDarkQuery(systemDark);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => system),
  );
  vi.resetModules();
  const theme = await import("@/store/themeStore");
  return { theme, system };
}

/** What the page shows: the class on <html>, `color-scheme` and the theme colour. */
function page(): { dark: boolean; colorScheme: string; themeColor: string | null } {
  const root = document.documentElement;
  return {
    dark: root.classList.contains("dark"),
    colorScheme: root.style.colorScheme,
    themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null,
  };
}

/** `localStorage` throws on every access, as in a browser that blocks site data. */
function blockStorage(): void {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    },
  });
}

/** The inline `<script>` in the head of index.html. */
function inlineScript(): string {
  const html = readFileSync("index.html", "utf-8");
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (script === undefined) throw new Error("index.html has no inline script");
  return script;
}

beforeEach(() => {
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff" />';
  STORAGE.clear();
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: STORAGE,
  });
  vi.stubGlobal("matchMedia", undefined);
});

describe("Theme store on load", () => {
  it("follows the system when nothing is stored", async () => {
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "dark",
    });
    expect(page()).toEqual({ dark: true, colorScheme: "dark", themeColor: "#0f172a" });
  });

  it("shows the light look on a light system", async () => {
    const { theme } = await load(false);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "light",
    });
    expect(page()).toEqual({ dark: false, colorScheme: "light", themeColor: "#ffffff" });
  });

  it("uses a stored Dark choice on a light system", async () => {
    STORAGE.setItem(KEY, "dark");
    const { theme } = await load(false);
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "dark", resolved: "dark" });
    expect(page().dark).toBe(true);
  });

  it("uses a stored Light choice on a dark system", async () => {
    STORAGE.setItem(KEY, "light");
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: "light",
      resolved: "light",
    });
    expect(page().dark).toBe(false);
  });

  it("treats a stored `system` value as no choice", async () => {
    STORAGE.setItem(KEY, "system");
    const { theme, system } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: null, resolved: "dark" });

    system.change(false);
    expect(theme.useThemeStore.getState().resolved).toBe("light");
  });

  it("ignores a stored value it does not know", async () => {
    STORAGE.setItem(KEY, "sepia");
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "dark",
    });
  });

  it("follows the system when localStorage is missing", async () => {
    vi.stubGlobal("localStorage", undefined);
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "dark",
    });

    theme.useThemeStore.getState().toggle();
    expect(theme.useThemeStore.getState().resolved).toBe("light");
  });

  it("follows the system when localStorage throws", async () => {
    blockStorage();
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "dark",
    });

    theme.useThemeStore.getState().toggle();
    expect(theme.useThemeStore.getState().resolved).toBe("light");
    expect(page().dark).toBe(false);
  });

  it("follows the system when the methods of localStorage throw", async () => {
    const denied = (): never => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    const { theme } = await load(true);
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "dark",
    });

    theme.useThemeStore.getState().toggle();
    expect(theme.useThemeStore.getState().resolved).toBe("light");
  });

  it("shows light where there is no matchMedia", async () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.resetModules();
    const theme = await import("@/store/themeStore");
    expect(theme.useThemeStore.getState()).toMatchObject({
      choice: null,
      resolved: "light",
    });
  });

  it("gives React the neutral state as its first, server-side state", async () => {
    // The pre-built guide was rendered with this state, so its hydration must start from it.
    STORAGE.setItem(KEY, "dark");
    const { theme } = await load(true);
    expect(theme.useThemeStore.getInitialState()).toMatchObject({
      choice: null,
      resolved: "light",
    });
  });
});

describe("Theme store choices", () => {
  it("switches to the opposite look on each toggle and stores it", async () => {
    const { theme } = await load(false);
    const { toggle } = theme.useThemeStore.getState();

    toggle();
    expect(STORAGE.getItem(KEY)).toBe("dark");
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "dark", resolved: "dark" });
    expect(page()).toEqual({ dark: true, colorScheme: "dark", themeColor: "#0f172a" });

    toggle();
    expect(STORAGE.getItem(KEY)).toBe("light");
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "light", resolved: "light" });
    expect(page()).toEqual({ dark: false, colorScheme: "light", themeColor: "#ffffff" });
  });

  it("toggles to the opposite of what the system shows", async () => {
    const { theme } = await load(true);
    theme.useThemeStore.getState().toggle();
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "light", resolved: "light" });
  });

  it("follows a change of the system setting while there is no choice", async () => {
    const { theme, system } = await load(false);

    system.change(true);
    expect(theme.useThemeStore.getState().resolved).toBe("dark");
    expect(page().dark).toBe(true);

    system.change(false);
    expect(theme.useThemeStore.getState().resolved).toBe("light");
    expect(page().dark).toBe(false);
  });

  it("keeps the choice when the system setting changes", async () => {
    const { theme, system } = await load(false);
    theme.useThemeStore.getState().toggle();

    system.change(false);
    system.change(true);
    expect(theme.useThemeStore.getState().resolved).toBe("dark");

    theme.useThemeStore.getState().toggle();
    system.change(true);
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "light", resolved: "light" });
    expect(page().dark).toBe(false);
  });

  it("uses the saved choice over the system after a reload", async () => {
    const first = await load(false);
    first.theme.useThemeStore.getState().toggle();

    const { theme } = await load(false);
    expect(theme.useThemeStore.getState()).toMatchObject({ choice: "dark", resolved: "dark" });
    expect(page().dark).toBe(true);
  });
});

describe("Inline theme script in index.html", () => {
  it("uses the store's storage key, query and colours", async () => {
    const { theme } = await load(false);
    const script = inlineScript();
    expect(script).toContain(`"${theme.THEME_STORAGE_KEY}"`);
    expect(script).toContain(`"${theme.DARK_QUERY}"`);
    expect(script).toContain(`"${theme.THEME_COLORS.light}"`);
    expect(script).toContain(`"${theme.THEME_COLORS.dark}"`);
  });

  // Each case: what is stored (or a blocked storage), the system setting, the look.
  const cases: [string | null | "blocked", boolean, ResolvedTheme][] = [
    [null, false, "light"],
    [null, true, "dark"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["light", false, "light"],
    ["light", true, "light"],
    ["system", false, "light"],
    ["system", true, "dark"],
    ["sepia", true, "dark"],
    ["blocked", true, "dark"],
  ];

  it.each(
    cases,
  )("agrees with the store (stored %s, system dark %s)", async (stored, systemDark, look) => {
    if (stored === "blocked") blockStorage();
    else if (stored !== null) STORAGE.setItem(KEY, stored);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => new FakeDarkQuery(systemDark)),
    );

    // The script runs before any module, exactly as the browser runs it in the head.
    new Function(inlineScript())();
    const fromScript = page();
    expect(fromScript.dark).toBe(look === "dark");

    const { theme } = await load(systemDark);
    expect(theme.useThemeStore.getState().resolved).toBe(look);
    expect(page()).toEqual(fromScript);
  });
});
