// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageFile, PnmlFile } from "@/lib/download";
import { useBuildStore } from "@/store/buildStore";
import { Toolbar } from "@/ui/Toolbar";

describe("Toolbar export-as menu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the menu and exports PNML / PNG / SVG", async () => {
    const pnmlSpy = vi.spyOn(PnmlFile, "save").mockImplementation(() => {});
    const svgSpy = vi.spyOn(ImageFile, "saveSvg").mockImplementation(() => {});
    const pngSpy = vi.spyOn(ImageFile, "savePng").mockImplementation(() => {});
    render(<Toolbar />);

    // The menu is hidden until the "Export as" button is clicked.
    expect(screen.queryByText("SVG vector")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Export as/ }));
    await userEvent.click(screen.getByText("PNML"));
    expect(pnmlSpy).toHaveBeenCalledTimes(1);
    // Selecting an item closes the menu.
    expect(screen.queryByText("PNML")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Export as/ }));
    await userEvent.click(screen.getByText("SVG vector"));
    expect(svgSpy).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /Export as/ }));
    await userEvent.click(screen.getByText("PNG image"));
    expect(pngSpy).toHaveBeenCalledTimes(1);
  });

  it("closes the menu on Escape", async () => {
    render(<Toolbar />);
    await userEvent.click(screen.getByRole("button", { name: /Export as/ }));
    expect(screen.getByText("SVG vector")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("SVG vector")).not.toBeInTheDocument();
  });
});

describe("Toolbar snap button", () => {
  afterEach(cleanup);

  it("names the snap state in a quick tooltip instead of a browser title", () => {
    useBuildStore.setState({ snap: true });
    render(<Toolbar />);
    const button = screen.getByRole("button", { name: "Snap to grid" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).not.toHaveAttribute("title");

    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Snap to grid: on. Click to turn off.");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Snap to grid: off. Click to turn on.");
  });

  it("gives Export as a quick tooltip instead of a browser title", () => {
    render(<Toolbar />);
    const button = screen.getByRole("button", { name: /Export as/ });
    expect(button).not.toHaveAttribute("title");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Export the net as PNML, PNG, or SVG");
  });

  it("keeps the Export as tooltip hidden while its menu is open", () => {
    render(<Toolbar />);
    const button = screen.getByRole("button", { name: /Export as/ });
    fireEvent.click(button);
    fireEvent.focus(button);
    expect(screen.getByText("SVG vector")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Toolbar brand", () => {
  afterEach(cleanup);

  it("names the site in the page's level-one heading", () => {
    render(<Toolbar />);
    // The short form "PetriNet" may be what shows, but the heading's name is always the full one.
    expect(screen.getByRole("heading", { level: 1, name: "PetriNet Editor" })).toBeInTheDocument();
  });
});
