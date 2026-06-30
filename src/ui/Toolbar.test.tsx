// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageFile } from "@/lib/download";
import { Toolbar } from "@/ui/Toolbar";

describe("Toolbar image export", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the image menu and exports SVG / PNG", async () => {
    const svgSpy = vi.spyOn(ImageFile, "saveSvg").mockImplementation(() => {});
    const pngSpy = vi.spyOn(ImageFile, "savePng").mockImplementation(() => {});
    render(<Toolbar />);

    // The menu is hidden until the Image button is clicked.
    expect(screen.queryByText("SVG vector")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Image/ }));
    await userEvent.click(screen.getByText("SVG vector"));
    expect(svgSpy).toHaveBeenCalledTimes(1);
    // Selecting an item closes the menu.
    expect(screen.queryByText("SVG vector")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Image/ }));
    await userEvent.click(screen.getByText("PNG image"));
    expect(pngSpy).toHaveBeenCalledTimes(1);
  });

  it("closes the image menu on Escape", async () => {
    render(<Toolbar />);
    await userEvent.click(screen.getByRole("button", { name: /Image/ }));
    expect(screen.getByText("SVG vector")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("SVG vector")).not.toBeInTheDocument();
  });
});
