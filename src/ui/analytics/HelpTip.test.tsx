// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpTip } from "@/ui/analytics/HelpTip";
import { HELP_TEXTS } from "@/ui/analytics/helpTexts";

function renderIcon(): HTMLElement {
  render(<HelpTip topic="Bounded" />);
  return screen.getByRole("button", { name: "Help: Bounded" });
}

/** Focus `el` the way a Tab does: jsdom cannot tell a Tab from a script focus, so the test states it. */
function keyboardFocus(el: HTMLElement): void {
  const matches = Element.prototype.matches;
  vi.spyOn(el, "matches").mockImplementation((selector: string) =>
    selector === ":focus-visible" ? true : matches.call(el, selector),
  );
  fireEvent.focus(el);
}

/** A finger tap: a touch press, then the click that the browser sends after it. */
function tap(el: Element): void {
  fireEvent.pointerDown(el, { pointerType: "touch" });
  fireEvent.click(el);
}

describe("HelpTip", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens at once when the mouse enters the icon and closes when it leaves", () => {
    const icon = renderIcon();
    fireEvent.pointerEnter(icon, { pointerType: "mouse", clientX: 100, clientY: 50 });
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("Bounded");
    expect(card).toHaveTextContent(HELP_TEXTS.Bounded.meaning);
    expect(card).toHaveTextContent(HELP_TEXTS.Bounded.tellsYou);
    expect(card).toHaveTextContent(HELP_TEXTS.Bounded.example);
    expect(icon).toHaveAttribute("aria-describedby", card.id);

    fireEvent.pointerLeave(icon, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does nothing on a mouse click", () => {
    const icon = renderIcon();
    fireEvent.pointerDown(icon, { pointerType: "mouse" });
    fireEvent.click(icon);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on keyboard focus and closes on blur", () => {
    const icon = renderIcon();
    keyboardFocus(icon);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(icon);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes on Escape and keeps that Escape from the window's listeners", () => {
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    const icon = renderIcon();
    keyboardFocus(icon);
    fireEvent.keyDown(document, { key: "Escape" });
    window.removeEventListener("keydown", onWindowKey);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it("toggles on a touch tap and ignores the touch pointer leaving", () => {
    const icon = renderIcon();
    fireEvent.pointerEnter(icon, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    tap(icon);
    fireEvent.pointerLeave(icon, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    tap(icon);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("closes a tapped card on a tap elsewhere or a scroll", () => {
    const icon = renderIcon();
    tap(icon);
    fireEvent.pointerDown(document.body, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    tap(icon);
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
