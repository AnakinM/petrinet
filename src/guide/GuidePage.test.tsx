// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidePage } from "@/guide/GuidePage";
import { useThemeStore } from "@/store/themeStore";
import { ThemeTestHelpers } from "@/store/themeTestHelpers";
import { SunIcon } from "@/ui/icons";

describe("GuidePage", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    ThemeTestHelpers.reset();
  });

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

  it("names the site PetriNet Editor in its top bar link, not in a second h1", () => {
    const { getAllByRole, getByRole } = render(<GuidePage />);
    expect(getByRole("link", { name: "PetriNet Editor" })).toHaveAttribute("href", "/");
    expect(getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("keeps the visible copy free of em dashes", () => {
    const { container } = render(<GuidePage />);
    expect(container.textContent).not.toMatch(/[\u2014\u2013]/);
  });

  it("hydrates its server-rendered HTML with no mismatch warning", async () => {
    // The same tree that the build pre-renders and that main.tsx hydrates.
    const page = (
      <StrictMode>
        <GuidePage />
      </StrictMode>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.appendChild(container);
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");

    const root = await act(async () => hydrateRoot(container, page));

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(document.title).toBe("What is a Petri net? Guide and examples | PetriNet Editor");
    act(() => root.unmount());
    container.remove();
  });

  it("hydrates with a stored Dark choice and then shows the sun icon", async () => {
    const page = (
      <StrictMode>
        <GuidePage />
      </StrictMode>
    );
    // The build renders with no stored choice; this visitor chose Dark on an earlier visit.
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.appendChild(container);
    useThemeStore.getState().toggle();
    const error = vi.spyOn(console, "error");

    const root = await act(async () => hydrateRoot(container, page));

    expect(error).not.toHaveBeenCalled();
    const theme = container.querySelector('button[aria-label="Switch to light theme"]');
    expect(theme?.innerHTML).toBe(renderToStaticMarkup(<SunIcon />));
    act(() => root.unmount());
    container.remove();
  });
});
