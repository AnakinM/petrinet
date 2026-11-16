// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOOLTIP_DELAY_MS, Tooltip } from "@/ui/Tooltip";

function renderTooltip(): HTMLElement {
  render(
    <Tooltip label="Snap to grid: on.">
      {(trigger) => (
        <button type="button" {...trigger}>
          Snap
        </button>
      )}
    </Tooltip>,
  );
  return screen.getByRole("button", { name: "Snap" });
}

/**
 * Focus `el` the way a Tab does. jsdom cannot tell a Tab from a focus that a script moves, so the
 * test states it: the element matches `:focus-visible`.
 */
function keyboardFocus(el: HTMLElement, visible = true): void {
  const matches = Element.prototype.matches;
  vi.spyOn(el, "matches").mockImplementation((selector: string) =>
    selector === ":focus-visible" ? visible : matches.call(el, selector),
  );
  fireEvent.focus(el);
}

describe("Tooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows after the hover delay and hides on pointer leave", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Snap to grid: on.");
    expect(button).toHaveAttribute("aria-describedby", tooltip.id);

    fireEvent.pointerLeave(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("does not show when the pointer leaves before the delay", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);
    fireEvent.pointerLeave(button);
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows at once on keyboard focus and hides on blur", () => {
    const button = renderTooltip();
    keyboardFocus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("does not show for a focus that the browser does not mark as keyboard focus", () => {
    // For example a menu handing the focus back to its trigger after a mouse click.
    const button = renderTooltip();
    keyboardFocus(button, false);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on Escape", () => {
    const button = renderTooltip();
    keyboardFocus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on click, and the focus of a mouse press does not show it", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS));
    fireEvent.pointerDown(button);
    keyboardFocus(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on a keyboard click", () => {
    const button = renderTooltip();
    keyboardFocus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
