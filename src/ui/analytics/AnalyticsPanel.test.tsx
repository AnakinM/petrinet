// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { type AnalyticsTab, useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { AnalyticsPanel } from "@/ui/analytics/AnalyticsPanel";

const place = (id: string, tokens = 0): Place => ({
  id,
  name: id,
  tokens,
  position: { x: 0, y: 0 },
});
const transition = (id: string): Transition => ({ id, name: id, position: { x: 0, y: 0 } });
const arc = (source: string, target: string): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity: 1,
  points: [],
});

// One token shuttles P1 ⇄ P2: strictly conservative, bounded, with covering P/T-invariants.
const CYCLE: PetriNet = {
  places: [place("P1", 1), place("P2", 0)],
  transitions: [transition("t1"), transition("t2")],
  arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
};

function openWith(net: PetriNet, tab: AnalyticsTab = "invariants"): void {
  useNetStore.getState().setNet(net);
  useAnalyticsStore.setState({ open: true, activeTab: tab });
  useAnalyticsStore.getState().analyze();
}

describe("AnalyticsPanel", () => {
  beforeEach(() => {
    useAnalyticsStore.setState({
      open: false,
      activeTab: "invariants",
      result: null,
      width: 360,
      stale: false,
      running: false,
    });
  });
  afterEach(cleanup);

  it("renders nothing when closed", () => {
    const { container } = render(<AnalyticsPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the place & transition invariants of a conservative cycle", () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    expect(screen.getByText("Place invariants")).toBeInTheDocument();
    expect(screen.getByText("P1 + P2")).toBeInTheDocument();
    expect(
      screen.getByText("All places covered — structurally bounded & conservative."),
    ).toBeInTheDocument();
  });

  it("switches to the Properties tab and reports the strict conservation verdict", async () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(
      screen.getByText("Strictly conservative — the total token count never changes."),
    ).toBeInTheDocument();
  });

  it("shows an empty hint when there is nothing to analyse", () => {
    openWith({ places: [], transitions: [], arcs: [] });
    render(<AnalyticsPanel />);
    expect(screen.getByText(/Nothing to analyse/)).toBeInTheDocument();
  });
});
