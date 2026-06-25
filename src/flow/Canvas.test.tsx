// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Canvas } from "@/flow/Canvas";
import { SAMPLE_NET } from "@/flow/sampleNet";

beforeAll(() => {
  // React Flow measures its pane and nodes via ResizeObserver, which jsdom lacks.
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

describe("Canvas", () => {
  it("renders a labeled node for each place and transition", () => {
    render(<Canvas net={SAMPLE_NET} />);
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText("buffer")).toBeInTheDocument();
    expect(screen.getByText("start")).toBeInTheDocument();
    expect(screen.getByText("finish")).toBeInTheDocument();
  });
});
