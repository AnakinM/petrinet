// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { type AnalyticsTab, NO_SPOTLIGHT, useAnalyticsStore } from "@/store/analyticsStore";
import { useNetStore } from "@/store/netStore";
import { useNoticeStore } from "@/store/noticeStore";
import { AnalyticsPanel } from "@/ui/analytics/AnalyticsPanel";
import { COPY_FAILED } from "@/ui/analytics/copyActions";

const place = (id: string, tokens = 0): Place => ({
  id,
  name: id,
  tokens,
  position: { x: 0, y: 0 },
});
const transition = (id: string): Transition => ({ id, name: id, position: { x: 0, y: 0 } });
const arc = (source: string, target: string, multiplicity = 1): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity,
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

// The CYCLE with weight 2 on P1 → t1: the shape still fits a state machine, but the net is not ordinary.
const HEAVY: PetriNet = {
  ...CYCLE,
  places: [place("P1", 2), place("P2", 0)],
  arcs: [arc("P1", "t1", 2), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
};

// 250 tokens drain one by one from P into Q: 251 reachable markings, more than the table shows.
const LONG: PetriNet = {
  places: [place("P", 250), place("Q", 0)],
  transitions: [transition("t")],
  arcs: [arc("P", "t"), arc("t", "Q")],
};

function openWith(net: PetriNet, tab: AnalyticsTab = "invariants"): void {
  useNetStore.getState().setNet(net);
  useAnalyticsStore.setState({ open: true, activeTab: tab });
  useAnalyticsStore.getState().analyze();
}

async function analyse(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: /^Analyse/ }));
}

/** The card (a `section`) whose heading is `title`. */
function card(title: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: new RegExp(`^${title}`) });
  const section = heading.closest("section");
  if (!section) throw new Error(`No card for ${title}`);
  return section;
}

describe("AnalyticsPanel", () => {
  beforeEach(() => {
    useAnalyticsStore.setState({
      open: false,
      activeTab: "invariants",
      result: null,
      width: 400,
      stale: false,
      running: false,
      highlight: NO_SPOTLIGHT,
      highlightKey: null,
      preview: NO_SPOTLIGHT,
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<AnalyticsPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the name Analysis and five tabs", () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    expect(screen.getByRole("heading", { name: "Analysis" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close analysis" })).toBeInTheDocument();
    for (const name of [
      "Properties",
      "Classification",
      "Invariants",
      "Structure",
      "Reachability",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("renders the place & transition invariants of a conservative cycle", () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    expect(within(card("Place invariants")).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("P1 + P2")).toBeInTheDocument();
    expect(
      screen.getByText("All places covered, so the net is structurally bounded and conservative."),
    ).toBeInTheDocument();
  });

  it("switches to the Properties tab and reports the strict conservation verdict", async () => {
    openWith(CYCLE);
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Properties" }));
    expect(
      screen.getByText("The total token count never changes, so the net is strictly conservative."),
    ).toBeInTheDocument();
  });

  it("shows an empty hint and no Analyse bar when there is nothing to analyse", () => {
    openWith({ places: [], transitions: [], arcs: [] });
    render(<AnalyticsPanel />);
    expect(screen.getByText(/Nothing to analyse/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Analyse/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy results" })).not.toBeInTheDocument();
  });

  describe("Analyse bar", () => {
    it("asks for the full analysis, marks the cards that need it, then says it is up to date", async () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      expect(screen.getByText("Some results need the full analysis.")).toBeInTheDocument();
      expect(within(card("Live")).getByText("Needs the full analysis")).toBeInTheDocument();
      expect(
        within(card("Deadlock-free")).getByText("Needs the full analysis"),
      ).toBeInTheDocument();
      // Amber "Unknown" is kept for results that the analysis could not settle.
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();

      await analyse();
      expect(screen.getByText("Analysis is up to date. Explored 2 markings.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Analyse/ })).not.toBeInTheDocument();
      expect(
        screen.getByText("Every transition can fire again from every reachable marking."),
      ).toBeInTheDocument();
    });

    it("says the net changed after an edit, and is up to date again after Analyse again", async () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      await analyse();

      act(() => useNetStore.getState().setTokens("P1", 2));
      expect(
        screen.getByText("The net changed. The results may be out of date."),
      ).toBeInTheDocument();
      // The old results belong to the old net, so the cards wait for the new run.
      expect(within(card("Live")).getByText("Needs the full analysis")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Analyse again" }));
      expect(screen.getByText(/^Analysis is up to date/)).toBeInTheDocument();
    });

    it("stays on Analyse after an edit when the full analysis never ran", () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      act(() => useNetStore.getState().setTokens("P1", 2));
      expect(screen.getByText("Some results need the full analysis.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Analyse" })).toBeInTheDocument();
    });

    it("shows on every tab", async () => {
      openWith(CYCLE, "structure");
      render(<AnalyticsPanel />);
      expect(screen.getByRole("button", { name: "Analyse" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Reachability" }));
      expect(screen.getByRole("button", { name: "Analyse" })).toBeInTheDocument();
    });
  });

  describe("Properties", () => {
    it("lists a deadlock marking and its firing path in the Deadlock-free card", async () => {
      openWith(DEADLOCK, "properties");
      render(<AnalyticsPanel />);
      await analyse();
      const deadlockFree = card("Deadlock-free");
      expect(within(deadlockFree).getByText("Reaches a dead marking:")).toBeInTheDocument();
      expect(within(deadlockFree).getByText("P1=0, P2=0, P3=1")).toBeInTheDocument();
      expect(within(deadlockFree).getByText(/via t1.*t2/)).toBeInTheDocument();
    });

    it("never presents an incomplete (unbounded) state space as a definitive answer", async () => {
      openWith(UNBOUNDED, "properties");
      render(<AnalyticsPanel />);
      await analyse();
      expect(
        screen.getByText(/^Analysis is up to date\..*The net is unbounded/),
      ).toBeInTheDocument();
      expect(
        within(card("Deadlock-free")).getByText(/None found in the explored markings/),
      ).toBeInTheDocument();
      expect(within(card("Live")).getByText(/Never fires: undetermined/)).toBeInTheDocument();
      const bounded = card("Bounded");
      expect(within(bounded).getByText(/only lower limits/)).toBeInTheDocument();
      expect(within(bounded).getByText("no bound")).toBeInTheDocument();
    });

    it("shows the exact place bounds in the Bounded card after the full analysis", async () => {
      openWith(DEADLOCK, "properties");
      render(<AnalyticsPanel />);
      // The place bounds wait with the same words as a pending card, without a full stop.
      expect(within(card("Bounded")).getByText("Needs the full analysis")).toBeInTheDocument();
      await analyse();
      const bounded = card("Bounded");
      expect(within(bounded).queryByText(/lower limits/)).not.toBeInTheDocument();
      expect(within(bounded).getAllByText("1")).toHaveLength(3);
    });

    it("warns that other places may grow when the analysis stopped at an unbounded place", async () => {
      const PUMP_AND_STORE: PetriNet = {
        places: [place("P1", 0), place("P2", 1)],
        transitions: [transition("t1")],
        arcs: [arc("t1", "P1")],
      };
      openWith(PUMP_AND_STORE, "properties");
      render(<AnalyticsPanel />);
      await analyse();
      expect(
        within(card("Bounded")).getByText(
          "The analysis stopped when it proved the net unbounded. Other places may grow without limit too.",
        ),
      ).toBeInTheDocument();
    });

    it("gives a pending card no empty body", () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      const live = card("Live");
      // The header row only: no body under the title.
      expect(live.children).toHaveLength(1);
    });

    it("lights a transition that never fires from the Live card, and clears it on a second click", async () => {
      openWith(DEAD_T, "properties");
      render(<AnalyticsPanel />);
      await analyse();
      const chip = within(card("Live")).getByRole("button", { name: "starved" });
      await userEvent.click(chip);
      expect(useAnalyticsStore.getState().highlight).toEqual({ nodes: ["starved"], arcs: [] });
      await userEvent.click(chip);
      expect(useAnalyticsStore.getState().highlight).toEqual(NO_SPOTLIGHT);
    });

    it("renders an all-zero deadlock marking as non-interactive (nothing to spotlight)", async () => {
      // One token drained by a sink transition: dead at {p=0}, where no place holds a token.
      const DRAIN: PetriNet = {
        places: [place("p", 1)],
        transitions: [transition("drain")],
        arcs: [arc("p", "drain")],
      };
      openWith(DRAIN, "properties");
      render(<AnalyticsPanel />);
      await analyse();
      expect(screen.getByText("p=0")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /p=0/ })).not.toBeInTheDocument();
    });

    it("gives every property a help icon", () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      expect(screen.getAllByRole("button", { name: /^Help:/ }).length).toBeGreaterThanOrEqual(7);
    });
  });

  describe("highlight", () => {
    it("lights a chip's elements while hovered, without keeping them", async () => {
      openWith(CYCLE, "invariants");
      render(<AnalyticsPanel />);
      const chip = screen.getByRole("button", { name: /P1 \+ P2/ });
      fireEvent.pointerEnter(chip, { pointerType: "mouse" });
      expect(useAnalyticsStore.getState().preview).toEqual({ nodes: ["P1", "P2"], arcs: [] });
      expect(useAnalyticsStore.getState().highlight).toEqual(NO_SPOTLIGHT);
      fireEvent.pointerLeave(chip, { pointerType: "mouse" });
      expect(useAnalyticsStore.getState().preview).toEqual(NO_SPOTLIGHT);
    });

    it("clears the preview when a hovered chip disappears", () => {
      openWith(CYCLE, "invariants");
      const { unmount } = render(<AnalyticsPanel />);
      fireEvent.pointerEnter(screen.getByRole("button", { name: /P1 \+ P2/ }), {
        pointerType: "mouse",
      });
      expect(useAnalyticsStore.getState().preview.nodes).toEqual(["P1", "P2"]);
      unmount();
      expect(useAnalyticsStore.getState().preview).toEqual(NO_SPOTLIGHT);
    });

    it("drops the highlight when the active tab changes", async () => {
      openWith(CYCLE, "invariants");
      render(<AnalyticsPanel />);
      await userEvent.click(screen.getByRole("button", { name: /P1 \+ P2/ }));
      expect(useAnalyticsStore.getState().highlight.nodes).toEqual(["P1", "P2"]);
      await userEvent.click(screen.getByRole("button", { name: "Properties" }));
      expect(useAnalyticsStore.getState().highlight).toEqual(NO_SPOTLIGHT);
    });

    it("drops the highlight on a structural net edit", async () => {
      openWith(CYCLE, "invariants");
      render(<AnalyticsPanel />);
      await userEvent.click(screen.getByRole("button", { name: /P1 \+ P2/ }));
      act(() => useNetStore.getState().setTokens("P1", 2));
      expect(useAnalyticsStore.getState().highlight).toEqual(NO_SPOTLIGHT);
    });
  });

  describe("Invariants", () => {
    it("renders an invariant's structural vector and spotlights its support on click", async () => {
      openWith(CYCLE, "invariants");
      render(<AnalyticsPanel />);
      const chip = screen.getByRole("button", { name: /P1 \+ P2/ });
      expect(chip.textContent).toMatch(/\(1, 1\)/);
      await userEvent.click(chip);
      expect(useAnalyticsStore.getState().highlight).toEqual({ nodes: ["P1", "P2"], arcs: [] });
    });

    it("shows the incidence matrix and copies it as text and as an HTML table", async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal(
        "ClipboardItem",
        class {
          constructor(readonly parts: Record<string, Blob>) {}
        },
      );
      vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });
      openWith(CYCLE, "invariants");
      render(<AnalyticsPanel />);
      const matrix = card("Incidence matrix");
      expect(within(matrix).getByRole("columnheader", { name: "t1" })).toBeInTheDocument();
      expect(within(matrix).getByRole("rowheader", { name: "P1" })).toBeInTheDocument();
      expect(within(matrix).getAllByText("-1")).toHaveLength(2);

      await userEvent.click(within(matrix).getByRole("button", { name: "Copy as text" }));
      const [[items]] = write.mock.calls as [[{ parts: Record<string, Blob> }[]]];
      expect(await items[0].parts["text/plain"].text()).toBe("\tt1\tt2\nP1\t-1\t1\nP2\t1\t-1");
      expect(await items[0].parts["text/html"].text()).toContain("<table");
      expect(useNoticeStore.getState().message).toBe("Incidence matrix copied to the clipboard.");
    });
  });

  describe("Structure", () => {
    it("shows loops and net facts only", () => {
      openWith(CYCLE, "structure");
      render(<AnalyticsPanel />);
      expect(screen.getByText(/lie on a loop/)).toBeInTheDocument();
      expect(within(card("Loops")).getByText("1 loop")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /^Net facts/ })).toBeInTheDocument();
      expect(screen.queryByText("Dead transitions")).not.toBeInTheDocument();
      expect(screen.queryByText("Check reachable")).not.toBeInTheDocument();
    });
  });

  describe("Classification", () => {
    it("classifies a simple cycle as every structural class", async () => {
      openWith(CYCLE, "properties");
      render(<AnalyticsPanel />);
      await userEvent.click(screen.getByRole("button", { name: "Classification" }));
      expect(screen.getAllByText("Yes")).toHaveLength(4);
    });

    it("answers no for a heavy arc on a fitting shape, and lights that arc", async () => {
      openWith(HEAVY, "classification");
      render(<AnalyticsPanel />);
      const stateMachine = card("State machine");
      expect(within(stateMachine).getByText("No")).toBeInTheDocument();
      expect(
        within(stateMachine).getByText(
          "The shape fits a state machine, but 1 arc has a weight above 1.",
        ),
      ).toBeInTheDocument();
      await userEvent.click(
        within(stateMachine).getByRole("button", { name: "P1 → t1, weight 2" }),
      );
      expect(useAnalyticsStore.getState().highlight).toEqual({ nodes: [], arcs: ["P1->t1"] });
    });
  });

  describe("Reachability", () => {
    it("answers a reachability query", async () => {
      openWith(CYCLE, "reachability");
      render(<AnalyticsPanel />);
      // The form seeds with M0, which is trivially reachable from itself.
      await userEvent.click(screen.getByRole("button", { name: "Check reachable" }));
      expect(screen.getByText("This marking is reachable from M0.")).toBeInTheDocument();
    });

    it("lists the reachable markings after the full analysis and lights a row's marked places", async () => {
      openWith(DEADLOCK, "reachability");
      render(<AnalyticsPanel />);
      expect(within(card("State table")).getByText("Needs the full analysis")).toBeInTheDocument();
      await analyse();
      const table = card("State table");
      expect(within(table).getByText("3 markings")).toBeInTheDocument();
      expect(within(table).getByText("t1 to M1")).toBeInTheDocument();
      expect(within(table).getByText("deadlock")).toBeInTheDocument();

      await userEvent.click(within(table).getByRole("button", { name: "M2" }));
      expect(useAnalyticsStore.getState().highlight).toEqual({ nodes: ["P3"], arcs: [] });
    });

    it("keeps two markings with the same marked places apart: only the clicked one is pressed", async () => {
      // 3 tokens move from P to Q: M1 (2, 1) and M2 (1, 2) both mark P and Q.
      const MOVE: PetriNet = {
        places: [place("P", 3), place("Q", 0)],
        transitions: [transition("t")],
        arcs: [arc("P", "t"), arc("t", "Q")],
      };
      openWith(MOVE, "reachability");
      render(<AnalyticsPanel />);
      await analyse();
      const table = card("State table");
      const m1 = within(table).getByRole("button", { name: "M1" });
      const m2 = within(table).getByRole("button", { name: "M2" });
      await userEvent.click(m1);
      await userEvent.click(m2);
      expect(useAnalyticsStore.getState().highlight).toEqual({ nodes: ["P", "Q"], arcs: [] });
      expect(m1).toHaveAttribute("aria-pressed", "false");
      expect(m2).toHaveAttribute("aria-pressed", "true");
    });

    it("separates the firings of a marking with semicolons, as Copy table does", async () => {
      const CHOICE: PetriNet = {
        places: [place("P1", 1), place("P2", 0), place("P3", 0)],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P1", "t2"), arc("t2", "P3")],
      };
      openWith(CHOICE, "reachability");
      render(<AnalyticsPanel />);
      await analyse();
      expect(within(card("State table")).getByText("t1 to M1; t2 to M2")).toBeInTheDocument();
    });

    it("shows at most 200 rows and states the total", async () => {
      openWith(LONG, "reachability");
      render(<AnalyticsPanel />);
      await analyse();
      const table = card("State table");
      expect(within(table).getByText("251 markings")).toBeInTheDocument();
      expect(within(table).getByText(/Showing the first 200 of 251 markings/)).toBeInTheDocument();
      // The header row plus 200 marking rows.
      expect(within(table).getAllByRole("row")).toHaveLength(201);
    });
  });

  it("copies the whole analysis from the header, saying when it is out of date", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    openWith(CYCLE, "properties");
    render(<AnalyticsPanel />);
    await analyse();
    act(() => useNetStore.getState().setTokens("P1", 2));

    await userEvent.click(screen.getByRole("button", { name: "Copy results" }));
    const [[text]] = writeText.mock.calls as [[string]];
    expect(text.startsWith("Analysis\n")).toBe(true);
    expect(text).toContain("The results may be out of date.");
    expect(useNoticeStore.getState().message).toBe("Analysis results copied to the clipboard.");
  });

  it("says so in the notice when the browser refuses the copy", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Not allowed")) },
    });
    openWith(CYCLE, "properties");
    render(<AnalyticsPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Copy results" }));
    expect(useNoticeStore.getState().message).toBe(COPY_FAILED);
  });
});
