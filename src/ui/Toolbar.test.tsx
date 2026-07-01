// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageFile, PnmlFile } from "@/lib/download";
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
