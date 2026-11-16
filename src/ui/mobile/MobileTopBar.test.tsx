// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Analytics } from "@/lib/analytics";
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
    fireEvent.click(screen.getByRole("link", { name }));
    expect(track).toHaveBeenCalledExactlyOnceWith("Outbound link", { target });
  });
});
