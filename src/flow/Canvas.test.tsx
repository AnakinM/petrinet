// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Canvas } from "@/flow/Canvas";
import { SAMPLE_NET } from "@/flow/sampleNet";
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
