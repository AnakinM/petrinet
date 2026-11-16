// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { type EdgeProps, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Arc } from "@/domain/types";
import { ArcEdge } from "@/flow/edges/ArcEdge";
import type { ArcFlowEdge } from "@/flow/projection";
import { NO_SPOTLIGHT, useAnalyticsStore } from "@/store/analyticsStore";

const ARC: Arc = {
  id: "a1",
  source: "p1",
  target: "t1",
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity: 2,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};

function renderArc(): void {
  // The edge reads only these props; React Flow supplies the rest when it renders the edge itself.
  const props = { id: ARC.id, data: { arc: ARC }, selected: false } as EdgeProps<ArcFlowEdge>;
  render(
    <ReactFlowProvider>
      <svg>
        <title>arc</title>
        <ArcEdge {...props} />
      </svg>
    </ReactFlowProvider>,
  );
}

describe("ArcEdge analysis highlight", () => {
  afterEach(() => {
    cleanup();
    useAnalyticsStore.setState({ highlight: NO_SPOTLIGHT, preview: NO_SPOTLIGHT });
  });

  it("glows while the Analysis panel keeps or previews the arc", () => {
    renderArc();
    expect(screen.queryByTestId("arc-highlight")).not.toBeInTheDocument();

    act(() => useAnalyticsStore.setState({ preview: { nodes: [], arcs: ["a1"] } }));
    expect(screen.getByTestId("arc-highlight")).toBeInTheDocument();

    act(() => useAnalyticsStore.setState({ preview: NO_SPOTLIGHT }));
    expect(screen.queryByTestId("arc-highlight")).not.toBeInTheDocument();

    act(() => useAnalyticsStore.setState({ highlight: { nodes: [], arcs: ["a1"] } }));
    expect(screen.getByTestId("arc-highlight")).toBeInTheDocument();
  });

  it("does not glow when only a node with the same id is lit", () => {
    renderArc();
    act(() => useAnalyticsStore.setState({ highlight: { nodes: ["a1"], arcs: [] } }));
    expect(screen.queryByTestId("arc-highlight")).not.toBeInTheDocument();
  });
});
