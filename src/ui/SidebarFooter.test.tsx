// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "@/lib/analytics";
import { SidebarFooter } from "@/ui/SidebarFooter";

describe("SidebarFooter links", () => {
  afterEach(cleanup);

  it("links to the guide page", () => {
    render(<SidebarFooter />);
    expect(screen.getByRole("link", { name: "Guide" })).toHaveAttribute("href", "/guide");
  });

  it("links to the GitHub repository in a new tab", () => {
    render(<SidebarFooter />);
    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/AnakinM/petrinet");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("links to a fresh issue in a new tab", () => {
    render(<SidebarFooter />);
    const link = screen.getByRole("link", { name: "Report an issue" });
    expect(link).toHaveAttribute("href", "https://github.com/AnakinM/petrinet/issues/new");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("SidebarFooter usage events", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["GitHub", "github"],
    ["Report an issue", "issue"],
  ])("sends Outbound link when %s is clicked", (name, target) => {
    const track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    render(<SidebarFooter />);
    fireEvent.click(screen.getByRole("link", { name }));
    expect(track).toHaveBeenCalledExactlyOnceWith("Outbound link", { target });
  });

  it("sends nothing for the guide link", () => {
    const track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    render(<SidebarFooter />);
    fireEvent.click(screen.getByRole("link", { name: "Guide" }));
    expect(track).not.toHaveBeenCalled();
  });
});
