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
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on Escape", () => {
    const button = renderTooltip();
    fireEvent.focus(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on click, and the focus of a mouse press does not show it", () => {
    const button = renderTooltip();
    fireEvent.pointerEnter(button);
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS));
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on a keyboard click", () => {
    const button = renderTooltip();
    fireEvent.focus(button);
    fireEvent.click(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
