// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PetriNet } from "@/domain/types";
import { Canvas } from "@/flow/Canvas";
import { SAMPLE_NET } from "@/flow/sampleNet";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

beforeAll(() => {
  // React Flow measures its pane and nodes via ResizeObserver, which jsdom lacks.
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  // Canvas reads the net from the store; seed it deterministically.
  useNetStore.getState().setNet(SAMPLE_NET);
});

afterEach(cleanup);

describe("Canvas", () => {
  it("renders a labeled node for each place and transition", () => {
    render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    );
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("buffer")).toBeInTheDocument();
    expect(screen.getByText("start")).toBeInTheDocument();
    expect(screen.getByText("finish")).toBeInTheDocument();
  });
});

describe("Canvas token tool", () => {
  const ORIGIN = { x: 0, y: 0 };
  const NET: PetriNet = {
    places: [{ id: "p1", name: "buf", tokens: 0, position: ORIGIN }],
    transitions: [{ id: "t1", name: "go", position: ORIGIN }],
    arcs: [],
  };

  beforeEach(() => {
    useNetStore.getState().setNet(NET);
    useBuildStore.getState().setTool("token");
  });
  afterEach(() => useBuildStore.getState().setTool("idle"));

  function renderCanvas(): HTMLElement {
    return render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    ).container;
  }

  function clickNode(container: HTMLElement, id: string, opts?: { shiftKey: boolean }): void {
    const el = container.querySelector(`[data-id="${id}"]`);
    if (!el) throw new Error(`node ${id} not rendered`);
    fireEvent.click(el, opts);
  }

  const tokensOf = (id: string): number =>
    useNetStore.getState().net.places.find((p) => p.id === id)?.tokens ?? -1;

  it("adds a token when a place is clicked", () => {
    const container = renderCanvas();
    clickNode(container, "p1");
    expect(tokensOf("p1")).toBe(1);
  });

  it("removes a token on shift-click, clamped at zero", () => {
    const container = renderCanvas();
    clickNode(container, "p1");
    clickNode(container, "p1"); // 2
    clickNode(container, "p1", { shiftKey: true }); // 1
    expect(tokensOf("p1")).toBe(1);
    clickNode(container, "p1", { shiftKey: true }); // 0
    clickNode(container, "p1", { shiftKey: true }); // clamp at 0
    expect(tokensOf("p1")).toBe(0);
  });

  it("ignores clicks on a transition and never selects", () => {
    const container = renderCanvas();
    clickNode(container, "t1");
    expect(tokensOf("p1")).toBe(0);
    expect(useNetStore.getState().selection).toEqual({ nodes: [], edges: [] });
  });
});

describe("Canvas paste selection projection", () => {
  const ORIGIN = { x: 0, y: 0 };
  const NET: PetriNet = {
    places: [{ id: "p1", name: "p1", tokens: 0, position: ORIGIN }],
    transitions: [{ id: "t1", name: "t1", position: { x: 48, y: 0 } }],
    arcs: [],
  };

  beforeEach(() => {
    useNetStore.getState().setNet(NET);
    useNetStore.setState({ clipboard: null, _pasteCount: 0 });
    useBuildStore.getState().setTool("idle");
  });

  it("renders the pasted cluster as selected and deselects the originals", () => {
    const { container } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    );
    // Paste after mount (mirrors real use; mounting clobbers a pre-seeded selection to empty).
    act(() => {
      const store = useNetStore.getState();
      store.select({ nodes: ["p1", "t1"], edges: [] });
      store.copy();
      store.paste();
    });
    const pastedIds = useNetStore.getState().selection.nodes;
    expect(pastedIds).toHaveLength(2);
    for (const id of pastedIds) {
      expect(container.querySelector(`[data-id="${id}"]`)?.classList.contains("selected")).toBe(
        true,
      );
    }
    expect(container.querySelector('[data-id="p1"]')?.classList.contains("selected")).toBe(false);
  });
});
