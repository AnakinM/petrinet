// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "@/lib/analytics";
import { ImageFile } from "@/lib/download";
import { useThemeStore } from "@/store/themeStore";
import { ThemeTestHelpers } from "@/store/themeTestHelpers";
import { MobileTopBar } from "@/ui/mobile/MobileTopBar";

describe("MobileTopBar usage events", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    ThemeTestHelpers.reset();
  });

  it.each([
    ["GitHub", "github"],
    ["Report an issue", "issue"],
  ])("sends Outbound link when %s is tapped in the menu", (name, target) => {
    const track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name }));
    expect(track).toHaveBeenCalledExactlyOnceWith("Outbound link", { target });
  });
});

describe("MobileTopBar menu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the Export and Image groups of the desktop top bar", () => {
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const entries = (group: string): (string | null)[] =>
      within(screen.getByRole("group", { name: group }))
        .getAllByRole("menuitem")
        .map((item) => item.getAttribute("aria-label"));
    expect(entries("Export")).toEqual([".npn file", "PNML"]);
    expect(entries("Image")).toEqual([
      "PNG image",
      "SVG image",
      "LaTeX (TikZ)",
      "Copy to clipboard",
    ]);
  });

  it("sends Export with the format of the chosen entry", () => {
    const track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    vi.spyOn(ImageFile, "saveTikz").mockImplementation(() => {});
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "LaTeX (TikZ)" }));
    expect(track).toHaveBeenCalledExactlyOnceWith("Export", { format: "tikz" });
  });

  it("has one theme entry that names the switch and toggles the look", () => {
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Switch to dark theme" }));
    expect(useThemeStore.getState()).toMatchObject({ choice: "dark", resolved: "dark" });

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("menuitem", { name: "Switch to light theme" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
  });
});

describe("MobileTopBar brand", () => {
  afterEach(cleanup);

  it("names the site in the page's level-one heading", () => {
    render(<MobileTopBar />);
    // The short form "PetriNet" may be what shows, but the heading's name is always the full one.
    expect(screen.getByRole("heading", { level: 1, name: "PetriNet Editor" })).toBeInTheDocument();
  });
});
