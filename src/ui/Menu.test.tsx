// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu, type MenuSection } from "@/ui/Menu";

function renderMenu(sections: MenuSection[]): void {
  render(
    <>
      <Menu sections={sections}>
        {(trigger) => (
          <button type="button" {...trigger}>
            Pick
          </button>
        )}
      </Menu>
      <p>Outside</p>
    </>,
  );
}

const trigger = (): HTMLElement => screen.getByRole("button", { name: "Pick" });

describe("Menu", () => {
  afterEach(cleanup);

  it("opens on click, runs the chosen entry and closes", async () => {
    const onSelect = vi.fn();
    renderMenu([{ entries: [{ label: "One", onSelect }, { label: "Two" }] }]);
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Pick" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "One" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    // The chosen entry is gone, so the focus goes back to the trigger, not to the page.
    expect(trigger()).toHaveFocus();
  });

  it("moves through the entries with the keyboard and skips disabled ones", async () => {
    renderMenu([
      { entries: [{ label: "One" }, { label: "Off", disabled: true }] },
      { label: "More", entries: [{ label: "Two" }, { label: "Three" }] },
    ]);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Two" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Three" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("menuitem", { name: "Three" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveFocus();
    expect(screen.getByRole("group", { name: "More" })).toBeInTheDocument();
  });

  it.each([
    ["Enter", "{Enter}", "One"],
    ["Space", " ", "One"],
    ["Arrow Up", "{ArrowUp}", "Two"],
  ])("opens with %s on the trigger", async (_name, key, focused) => {
    renderMenu([{ entries: [{ label: "One" }, { label: "Two" }] }]);
    trigger().focus();
    await userEvent.keyboard(key);
    expect(screen.getByRole("menuitem", { name: focused })).toHaveFocus();
  });

  it("closes on Escape and returns the focus to the trigger", async () => {
    renderMenu([{ entries: [{ label: "One" }] }]);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("keeps its Escape from the window, where a placing tool listens", async () => {
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    renderMenu([{ entries: [{ label: "One" }] }]);
    await userEvent.click(trigger());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(onWindowKey).not.toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    // With the menu closed, Escape reaches the window again.
    await userEvent.keyboard("{Escape}");
    expect(onWindowKey).toHaveBeenCalledWith(expect.objectContaining({ key: "Escape" }));
    window.removeEventListener("keydown", onWindowKey);
  });

  it("returns the focus to the trigger after a keyboard choice", async () => {
    const onSelect = vi.fn();
    renderMenu([{ entries: [{ label: "One", onSelect }] }]);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("closes on a click outside", async () => {
    renderMenu([{ entries: [{ label: "One" }] }]);
    await userEvent.click(trigger());
    fireEvent.pointerDown(screen.getByText("Outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Tab and lets the browser move on from the trigger", async () => {
    renderMenu([{ entries: [{ label: "One" }] }]);
    await userEvent.click(trigger());
    const notPrevented = fireEvent.keyDown(screen.getByRole("menuitem", { name: "One" }), {
      key: "Tab",
    });
    expect(notPrevented).toBe(true);
    expect(trigger()).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("names an entry by its label and reads its hint as the description", async () => {
    renderMenu([{ entries: [{ label: "One", hint: "The first one" }] }]);
    await userEvent.click(trigger());
    expect(screen.getByRole("menuitem", { name: "One" })).toHaveAccessibleDescription(
      "The first one",
    );
  });

  it("renders a link entry that opens in a new tab", async () => {
    const onSelect = vi.fn();
    renderMenu([{ entries: [{ label: "Docs", href: "https://example.com", onSelect }] }]);
    await userEvent.click(trigger());
    const link = screen.getByRole("menuitem", { name: "Docs" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("follows a link entry on Space, as on Enter", async () => {
    const onSelect = vi.fn();
    renderMenu([{ entries: [{ label: "Docs", href: "https://example.com", onSelect }] }]);
    trigger().focus();
    await userEvent.keyboard("{ArrowDown}");
    const link = screen.getByRole("menuitem", { name: "Docs" });
    expect(link).toHaveFocus();
    const notPrevented = fireEvent.keyDown(link, { key: " " });
    expect(notPrevented).toBe(false);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });
});
