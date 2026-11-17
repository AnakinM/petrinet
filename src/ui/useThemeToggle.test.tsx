// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, useThemeStore } from "@/store/themeStore";
import { ThemeTestHelpers } from "@/store/themeTestHelpers";
import { MoonIcon, SunIcon } from "@/ui/icons";
import { Toolbar } from "@/ui/Toolbar";
import { useThemeToggle } from "@/ui/useThemeToggle";

function ThemeButton(): JSX.Element {
  const theme = useThemeToggle();
  return (
    <button type="button" aria-label={theme.label} onClick={theme.toggle}>
      {theme.icon}
    </button>
  );
}

/**
 * Focus `el` the way a Tab does. jsdom cannot tell a Tab from a focus that a script moves, so the
 * test states it: the element matches `:focus-visible`.
 */
function keyboardFocus(el: HTMLElement): void {
  const matches = Element.prototype.matches;
  vi.spyOn(el, "matches").mockImplementation(
    (selector: string) => selector === ":focus-visible" || matches.call(el, selector),
  );
  fireEvent.focus(el);
}

const LIGHT_NAME = "Switch to dark theme";
const DARK_NAME = "Switch to light theme";

/** The button shows exactly this icon. */
function expectIcon(name: string, icon: JSX.Element): void {
  expect(screen.getByRole("button", { name }).innerHTML).toBe(renderToStaticMarkup(icon));
}

describe("Theme button", () => {
  afterEach(() => {
    cleanup();
    ThemeTestHelpers.reset();
  });

  it("shows a moon and offers the dark theme while the app is light", () => {
    render(<ThemeButton />);
    expectIcon(LIGHT_NAME, <MoonIcon />);
  });

  it("shows a sun and offers the light theme while the app is dark", () => {
    useThemeStore.setState({ resolved: "dark" });
    render(<ThemeButton />);
    expectIcon(DARK_NAME, <SunIcon />);
  });

  it("switches to the other theme on each click and remembers it", async () => {
    render(<ThemeButton />);

    await userEvent.click(screen.getByRole("button", { name: LIGHT_NAME }));
    expect(useThemeStore.getState()).toMatchObject({ choice: "dark", resolved: "dark" });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expectIcon(DARK_NAME, <SunIcon />);

    await userEvent.click(screen.getByRole("button", { name: DARK_NAME }));
    expect(useThemeStore.getState()).toMatchObject({ choice: "light", resolved: "light" });
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expectIcon(LIGHT_NAME, <MoonIcon />);
  });
});

describe("Toolbar theme button", () => {
  afterEach(() => {
    cleanup();
    ThemeTestHelpers.reset();
  });

  it("sits just before the Analysis button and toggles on a click", async () => {
    render(<Toolbar />);
    const theme = screen.getByRole("button", { name: LIGHT_NAME });
    const analysis = screen.getByRole("button", { name: "Analysis" });
    expect(theme.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(theme.parentElement).toBe(analysis.parentElement);

    await userEvent.click(theme);
    expect(screen.getByRole("button", { name: DARK_NAME })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("names the switch in a quick tooltip, and the name follows the theme", () => {
    render(<Toolbar />);
    const button = screen.getByRole("button", { name: LIGHT_NAME });
    keyboardFocus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(LIGHT_NAME);

    fireEvent.click(button);
    keyboardFocus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(DARK_NAME);
  });
});
