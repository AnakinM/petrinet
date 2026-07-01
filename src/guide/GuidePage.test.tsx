// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GuidePage } from "@/guide/GuidePage";

describe("GuidePage", () => {
  afterEach(cleanup);

  it("renders the page with tool-drawn diagrams and screenshot slots", () => {
    const { container, getByRole, getAllByText } = render(<GuidePage />);

    // The page mounts and shows its heading and the section headings from the contents list.
    expect(getByRole("heading", { level: 1 })).toHaveTextContent(/Guide to the PetriNet/);
    expect(getByRole("heading", { name: "What is a Petri net?" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "How firing works" })).toBeInTheDocument();

    // Every example net is rendered as an inline SVG by the tool's own exporter.
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(6);

    // The three UI screenshots are wired in from public/guide.
    expect(container.querySelectorAll('img[src^="/guide/"]')).toHaveLength(3);

    // Links back to the editor exist.
    expect(getAllByText("Open the editor").length).toBeGreaterThan(0);
  });

  it("keeps the visible copy free of em dashes", () => {
    const { container } = render(<GuidePage />);
    expect(container.textContent).not.toMatch(/[—–]/);
  });
});
