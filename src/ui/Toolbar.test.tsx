// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { Analytics } from "@/lib/analytics";
import { ImageFile, NpnFile, PnmlFile } from "@/lib/download";
import { useBuildStore } from "@/store/buildStore";
import { Toolbar } from "@/ui/Toolbar";

describe("Toolbar Export and Image menus", () => {
  let track: MockInstance<typeof Analytics.track>;

  beforeEach(() => {
    track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const openMenu = (name: string): Promise<void> =>
    userEvent.click(screen.getByRole("button", { name }));

  it("offers the two net files under Export", async () => {
    const npn = vi.spyOn(NpnFile, "save").mockImplementation(() => {});
    const pnml = vi.spyOn(PnmlFile, "save").mockImplementation(() => {});
    render(<Toolbar />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await openMenu("Export");
    expect(screen.getByRole("menuitem", { name: ".npn file" })).toHaveAccessibleDescription(
      "Opens again in this editor",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: ".npn file" }));
    expect(npn).toHaveBeenCalledOnce();
    // Choosing an entry closes the menu.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await openMenu("Export");
    expect(screen.getByRole("menuitem", { name: "PNML" })).toHaveAccessibleDescription(
      "For other Petri net tools",
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "PNML" }));
    expect(pnml).toHaveBeenCalledOnce();
    expect(track.mock.calls).toEqual([
      ["Export", { format: "npn" }],
      ["Export", { format: "pnml" }],
    ]);
  });

  it("offers the pictures under Image", async () => {
    vi.spyOn(ImageFile, "savePng").mockImplementation(() => {});
    vi.spyOn(ImageFile, "saveSvg").mockImplementation(() => {});
    vi.spyOn(ImageFile, "saveTikz").mockImplementation(() => {});
    vi.spyOn(ImageFile, "canCopy").mockReturnValue(true);
    vi.spyOn(ImageFile, "copyPng").mockResolvedValue();
    render(<Toolbar />);

    await openMenu("Image");
    const names = screen.getAllByRole("menuitem").map((item) => item.getAttribute("aria-label"));
    expect(names).toEqual(["PNG image", "SVG image", "LaTeX (TikZ)", "Copy to clipboard"]);

    for (const name of names) {
      if (!name) continue;
      if (!screen.queryByRole("menu")) await openMenu("Image");
      await userEvent.click(screen.getByRole("menuitem", { name }));
    }
    expect(track.mock.calls).toEqual(
      ["png", "svg", "tikz", "clipboard"].map((format) => ["Export", { format }]),
    );
  });

  it("opens from the keyboard and closes on Escape", async () => {
    render(<Toolbar />);
    screen.getByRole("button", { name: "Image" }).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "PNG image" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Image" })).toHaveFocus();
  });

  it.each([
    ["Export", "Save the net as a file that can be imported again"],
    ["Image", "Save or copy a picture of the net"],
  ])("gives %s a quick tooltip that hides while its menu is open", (name, tip) => {
    render(<Toolbar />);
    const button = screen.getByRole("button", { name });
    expect(button).not.toHaveAttribute("title");
    fireEvent.focus(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(tip);

    fireEvent.click(button);
    fireEvent.focus(button);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
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
});

describe("Toolbar brand", () => {
  afterEach(cleanup);

  it("names the site in the page's level-one heading", () => {
    render(<Toolbar />);
    // The short form "PetriNet" may be what shows, but the heading's name is always the full one.
    expect(screen.getByRole("heading", { level: 1, name: "PetriNet Editor" })).toBeInTheDocument();
  });
});
