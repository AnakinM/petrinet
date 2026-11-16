// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOTICE_MS, useNoticeStore } from "@/store/noticeStore";
import { Notice } from "@/ui/Notice";

const show = (message: string): void => act(() => useNoticeStore.getState().show(message));

describe("Notice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useNoticeStore.setState({ message: null });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("announces a message in a live region and hides it after a while", () => {
    render(<Notice />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    show("Picture copied to the clipboard.");
    expect(region).toHaveTextContent("Picture copied to the clipboard.");

    act(() => vi.advanceTimersByTime(NOTICE_MS));
    expect(region).toBeEmptyDOMElement();
  });

  it("shows one message at a time, and a new one restarts the timer", () => {
    render(<Notice />);
    show("First");
    act(() => vi.advanceTimersByTime(NOTICE_MS - 500));
    show("Second");
    expect(screen.getByRole("status")).toHaveTextContent(/^Second$/);

    act(() => vi.advanceTimersByTime(NOTICE_MS - 500));
    expect(screen.getByRole("status")).toHaveTextContent("Second");
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("restarts the timer when the same message is shown again", () => {
    render(<Notice />);
    show("Copied");
    act(() => vi.advanceTimersByTime(NOTICE_MS - 500));
    show("Copied");
    act(() => vi.advanceTimersByTime(NOTICE_MS - 500));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });
});
