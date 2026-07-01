// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Arc, PetriNet } from "@/domain/types";
import { useSimStore } from "@/store/simStore";
import { SimControls } from "@/ui/SimControls";

const ORIGIN = { x: 0, y: 0 };

function arc(id: string, source: string, target: string): Arc {
  return { id, source, target, srcMagnetic: true, destMagnetic: true, multiplicity: 1, points: [] };
}

// p1 --> t1 --> p2, one token in p1: t1 is enabled and fires p1's token to p2, then the net is dead.
const NET: PetriNet = {
  places: [
    { id: "p1", name: "P1", tokens: 1, position: ORIGIN },
    { id: "p2", name: "P2", tokens: 0, position: ORIGIN },
  ],
  transitions: [{ id: "t1", name: "T1", position: ORIGIN }],
  arcs: [arc("a1", "p1", "t1"), arc("a2", "t1", "p2")],
};

const button = (name: RegExp): HTMLElement => screen.getByRole("button", { name });

describe("SimControls transport", () => {
  beforeEach(() => useSimStore.getState().start(NET));
  afterEach(() => {
    cleanup();
    useSimStore.getState().stop();
  });

  it("fires one transition on Step", () => {
    render(<SimControls />);
    fireEvent.click(button(/Step/));

    expect(useSimStore.getState().marking).toEqual({ p1: 0, p2: 1 });
    expect(useSimStore.getState().history.steps).toHaveLength(1);
  });

  it("returns to M0 on Reset", () => {
    render(<SimControls />);
    fireEvent.click(button(/Step/));
    fireEvent.click(button(/Reset/));

    expect(useSimStore.getState().marking).toEqual({ p1: 1, p2: 0 });
    expect(useSimStore.getState().history.steps).toHaveLength(0);
  });

  it("auto-runs on a timer while playing, then stops at a dead marking", () => {
    vi.useFakeTimers();
    try {
      render(<SimControls />);
      fireEvent.click(button(/Play/));
      expect(useSimStore.getState().playing).toBe(true);

      // At the default rate (2/s => 500 ms/tick): tick 1 fires t1 into a dead marking, tick 2 finds
      // nothing enabled and stops the run.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(useSimStore.getState().marking).toEqual({ p1: 0, p2: 1 });
      expect(useSimStore.getState().playing).toBe(false);
      expect(button(/Play/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("disables Play and Step at a dead marking", () => {
    act(() => useSimStore.getState().step()); // fire t1 up front -> nothing left enabled
    render(<SimControls />);

    expect(button(/Play/)).toBeDisabled();
    expect(button(/Step/)).toBeDisabled();
  });
});
