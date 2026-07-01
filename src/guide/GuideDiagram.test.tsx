// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GuideNets } from "@/guide/exampleNets";
import { GuideDiagram } from "@/guide/GuideDiagram";

describe("GuideDiagram", () => {
  afterEach(cleanup);

  it("renders a net as an inline, responsive SVG with a caption", () => {
    const { container, getByText } = render(
      <GuideDiagram net={GuideNets.weighted()} caption="A weighted arc" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // The fixed pixel size is stripped so the diagram scales, but the viewBox is kept for its ratio.
    expect(svg?.hasAttribute("width")).toBe(false);
    expect(svg?.getAttribute("viewBox")).not.toBeNull();
    // The weight label from the net is present in the rendered markup.
    expect(svg?.textContent).toContain("2");
    expect(getByText("A weighted arc")).toBeInTheDocument();
  });
});
