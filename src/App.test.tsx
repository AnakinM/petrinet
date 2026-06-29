// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import type { PetriNet } from "@/domain/types";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

const ORIGIN = { x: 0, y: 0 };
const NET: PetriNet = {
  places: [{ id: "p1", name: "Buffer", tokens: 0, position: ORIGIN }],
  transitions: [{ id: "t1", name: "Emit", position: ORIGIN }],
  arcs: [
    {
      id: "a1",
      source: "p1",
      target: "t1",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [],
    },
  ],
};

beforeAll(() => {
  // jsdom lacks both APIs React Flow / HistoryList rely on.
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  useNetStore.getState().setNet(NET);
  useNetStore.getState().setMode("build");
  useBuildStore.getState().consumeNameFocus(); // clear any leftover request
});

afterEach(cleanup);

// The Canvas mirrors React Flow's selection into the store on mount (clobbering any pre-seeded
// value), so selection is driven in *after* mount — the store stays the source the keydown reads.
function pressEnter(): void {
  fireEvent.keyDown(document.body, { key: "Enter" });
}

describe("Enter-to-rename keydown handler", () => {
  it("focuses and selects the Name field for a single selected node in Build", () => {
    render(<App />);
    act(() => useNetStore.getState().select({ nodes: ["p1"], edges: [] }));
    const input = screen.getByDisplayValue("Buffer") as HTMLInputElement;
    expect(input).not.toHaveFocus();

    pressEnter();

    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Buffer".length);
  });

  it("does nothing when multiple nodes are selected", () => {
    render(<App />);
    act(() => useNetStore.getState().select({ nodes: ["p1", "t1"], edges: [] }));

    pressEnter();

    expect(useBuildStore.getState().nameFocusRequested).toBe(false);
  });

  it("does nothing when only an arc is selected", () => {
    render(<App />);
    act(() => useNetStore.getState().select({ nodes: [], edges: ["a1"] }));

    pressEnter();

    expect(useBuildStore.getState().nameFocusRequested).toBe(false);
  });

  it("does nothing in Simulate mode", () => {
    useNetStore.getState().setMode("simulate");
    render(<App />);

    pressEnter();

    expect(useBuildStore.getState().nameFocusRequested).toBe(false);
  });
});
