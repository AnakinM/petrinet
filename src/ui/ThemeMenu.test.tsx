// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, useThemeStore } from "@/store/themeStore";
import { MonitorIcon, MoonIcon, SunIcon } from "@/ui/icons";
import { THEME_LABEL, ThemeIcon, ThemeMenu } from "@/ui/ThemeMenu";
import { Toolbar } from "@/ui/Toolbar";

function renderThemeMenu(): void {
  render(
    <ThemeMenu>
      {(trigger) => (
        <button type="button" {...trigger} aria-label={THEME_LABEL}>
          <ThemeIcon />
        </button>
      )}
    </ThemeMenu>,
  );
}

const button = (): HTMLElement => screen.getByRole("button", { name: THEME_LABEL });

/** The button shows exactly this icon. */
function expectIcon(icon: JSX.Element): void {
  expect(button().innerHTML).toBe(renderToStaticMarkup(icon));
}

describe("ThemeMenu", () => {
  afterEach(() => {
    cleanup();
    useThemeStore.getState().setPreference("system");
  });

  it("offers System, Light and Dark, with a check on the current one", async () => {
    renderThemeMenu();
    expectIcon(<MonitorIcon />);

    await userEvent.click(button());
    const choices = screen.getAllByRole("menuitemradio");
    expect(choices.map((c) => c.textContent)).toEqual(["System", "Light", "Dark"]);
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("chooses each option, keeps it and shows its icon", async () => {
    renderThemeMenu();
    const steps: [string, "system" | "light" | "dark", JSX.Element, string | null][] = [
      ["Dark", "dark", <MoonIcon key="dark" />, "dark"],
      ["Light", "light", <SunIcon key="light" />, "light"],
      ["System", "system", <MonitorIcon key="system" />, null],
    ];
    for (const [label, preference, icon, stored] of steps) {
      await userEvent.click(button());
      await userEvent.click(screen.getByRole("menuitemradio", { name: label }));

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(useThemeStore.getState().preference).toBe(preference);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(stored);
      expectIcon(icon);

      await userEvent.click(button());
      expect(screen.getByRole("menuitemradio", { name: label })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await userEvent.keyboard("{Escape}");
    }
  });

  it("turns the page dark and back", async () => {
    renderThemeMenu();
    await userEvent.click(button());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(document.documentElement).toHaveClass("dark");

    await userEvent.click(button());
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });
});

describe("Toolbar theme button", () => {
  afterEach(cleanup);

  it("sits just before the Analysis button and opens the theme menu", async () => {
    render(<Toolbar />);
    const theme = screen.getByRole("button", { name: THEME_LABEL });
    const analysis = screen.getByRole("button", { name: "Analysis" });
    expect(theme.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(theme.parentElement?.parentElement).toBe(analysis.parentElement);

    await userEvent.click(theme);
    const menu = screen.getByRole("menu", { name: THEME_LABEL });
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(3);
  });
});
