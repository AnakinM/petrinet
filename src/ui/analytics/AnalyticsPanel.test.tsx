// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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

// One token drains P1 → t1 → P2 → t2 → P3 (a sink): runs into a deadlock at {P3=1}.
const DEADLOCK: PetriNet = {
  places: [place("P1", 1), place("P2", 0), place("P3", 0)],
  transitions: [transition("t1"), transition("t2")],
  arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P3")],
};

// A source transition pumping P1 with no consumer: unbounded ⇒ the reachability graph never completes.
const UNBOUNDED: PetriNet = {
  places: [place("P1", 0)],
  transitions: [transition("t1")],
  arcs: [arc("t1", "P1")],
};

// A live P1 ⇄ P2 cycle plus `starved`, which needs P3 (never marked) ⇒ a structurally dead
// transition. `starved` has both an input and an output, so it shows up only as a dead transition.
const DEAD_T: PetriNet = {
  places: [place("P1", 1), place("P2", 0), place("P3", 0)],
  transitions: [transition("t1"), transition("t2"), transition("starved")],
  arcs: [
    arc("P1", "t1"),
    arc("t1", "P2"),
    arc("P2", "t2"),
    arc("t2", "P1"),
    arc("P3", "starved"),
    arc("starved", "P2"),
  ],
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
      highlight: [],
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
      screen.getByText("All places covered, so the net is structurally bounded and conservative."),
    ).toBeInTheDocument();
  });

  it("switches to the Properties tab and reports the strict conservation verdict", async () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(
      screen.getByText("The total token count never changes, so the net is strictly conservative."),
    ).toBeInTheDocument();
  });

  it("shows an empty hint when there is nothing to analyse", () => {
    openWith({ places: [], transitions: [], arcs: [] });
    render(<AnalyticsPanel />);
    expect(screen.getByText(/Nothing to analyse/)).toBeInTheDocument();
  });

  it("resolves the behavioural verdicts only after Re-analyze", async () => {
    openWith(CYCLE, "properties");
    render(<AnalyticsPanel />);
    // The behavioural pass is on-demand, so the behavioural rows start unsettled.
    expect(screen.getAllByText(/Run Re-analyze/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    expect(
      screen.getByText("Every transition can fire again from every reachable marking."),
    ).toBeInTheDocument();
  });

  it("flags the behavioural verdicts stale after a net edit and clears it on Re-analyze", async () => {
    openWith(CYCLE, "properties");
    render(<AnalyticsPanel />);
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();

    // Editing the net (a new reference) marks the on-demand verdicts out of date.
    act(() => useNetStore.getState().setTokens("P1", 2));
    expect(screen.getByText("Stale")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    expect(screen.queryByText("Stale")).not.toBeInTheDocument();
  });

  it("lists a deadlock marking and its firing path on the Structure tab after Re-analyze", async () => {
    openWith(DEADLOCK, "structure");
    render(<AnalyticsPanel />);
    // Behavioural diagnostics need the reachability pass first.
    expect(screen.getAllByText(/Run Re-analyze/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    expect(screen.getByText("P1=0, P2=0, P3=1")).toBeInTheDocument();
    expect(screen.getByText(/via t1.*t2/)).toBeInTheDocument();
  });

  it("never presents an incomplete (unbounded) net's structure as a definitive guarantee", async () => {
    openWith(UNBOUNDED, "structure");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    // The graph was pruned for unboundedness, so empty results must NOT read as "None".
    expect(screen.queryByText(/Every transition can fire/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/incomplete/).length).toBeGreaterThan(0);
  });

  it("spotlights a dead transition's node from the Structure tab, and clears on a second click", async () => {
    openWith(DEAD_T, "structure");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));

    const chip = screen.getByRole("button", { name: "starved" });
    await userEvent.click(chip);
    expect(useAnalyticsStore.getState().highlight).toEqual(["starved"]);
    // Clicking the lit chip again toggles the spotlight back off.
    await userEvent.click(chip);
    expect(useAnalyticsStore.getState().highlight).toEqual([]);
  });

  it("drops the highlight when the active tab changes", async () => {
    openWith(DEAD_T, "structure");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    await userEvent.click(screen.getByRole("button", { name: "starved" }));
    expect(useAnalyticsStore.getState().highlight).toEqual(["starved"]);

    await userEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(useAnalyticsStore.getState().highlight).toEqual([]);
  });

  it("drops the highlight on a structural net edit", async () => {
    openWith(DEAD_T, "structure");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));
    await userEvent.click(screen.getByRole("button", { name: "starved" }));
    expect(useAnalyticsStore.getState().highlight).toEqual(["starved"]);

    act(() => useNetStore.getState().setTokens("P1", 2));
    expect(useAnalyticsStore.getState().highlight).toEqual([]);
  });

  it("renders an all-zero deadlock marking as non-interactive (nothing to spotlight)", async () => {
    // One token drained by a sink transition: dead at {p=0}, where no place holds a token.
    const DRAIN: PetriNet = {
      places: [place("p", 1)],
      transitions: [transition("drain")],
      arcs: [arc("p", "drain")],
    };
    openWith(DRAIN, "structure");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Re-analyze" }));

    expect(screen.getByText("p=0")).toBeInTheDocument();
    // No tokens remain, so there is nothing to highlight — the row must not be a clickable button.
    expect(screen.queryByRole("button", { name: /p=0/ })).not.toBeInTheDocument();
  });
});
