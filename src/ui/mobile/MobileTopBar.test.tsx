// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "@/lib/analytics";
import { ImageFile } from "@/lib/download";
import { useThemeStore } from "@/store/themeStore";
import { MobileTopBar } from "@/ui/mobile/MobileTopBar";

describe("MobileTopBar usage events", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
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

  it("shows the three theme choices in one row and applies the tapped one", () => {
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    const choices = within(screen.getByRole("group", { name: "Theme" })).getAllByRole(
      "menuitemradio",
    );
    expect(choices.map((c) => c.getAttribute("aria-label"))).toEqual(["System", "Light", "Dark"]);
    // One row: the three entries share one parent.
    expect(new Set(choices.map((c) => c.parentElement)).size).toBe(1);

    fireEvent.click(choices[2] as HTMLElement);
    expect(useThemeStore.getState().preference).toBe("dark");
    useThemeStore.getState().setPreference("system");
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
