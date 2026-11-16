// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { NpnCodec } from "@/codec/npn";
import type { PetriNet } from "@/domain/types";
import { Analytics } from "@/lib/analytics";
import { useNetStore } from "@/store/netStore";
import { DropImport } from "@/ui/DropImport";
import { enterBuild, enterSimulate } from "@/ui/toolbarActions";

const OLD: PetriNet = {
  places: [{ id: "p1", name: "old", tokens: 0, position: { x: 0, y: 0 } }],
  transitions: [],
  arcs: [],
};
const NEW: PetriNet = {
  places: [{ id: "p1", name: "dropped", tokens: 2, position: { x: 40, y: 40 } }],
  transitions: [{ id: "t1", name: "go", position: { x: 120, y: 40 } }],
  arcs: [],
};

/** A drag event as the browser sends it for files from the desktop (jsdom has no DragEvent). */
function drag(type: string, files: File[] = [], types: string[] = ["Files"]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types, files, dropEffect: "none" } });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

const npnFile = (net: PetriNet): File => new File([NpnCodec.serialize(net)], "net.npn");
const names = (): string[] => useNetStore.getState().net.places.map((p) => p.name);

describe("DropImport", () => {
  let track: MockInstance<typeof Analytics.track>;

  beforeEach(() => {
    track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    vi.spyOn(window, "alert").mockImplementation(() => {});
    useNetStore.getState().setNet(OLD);
    render(<DropImport />);
  });

  afterEach(() => {
    cleanup();
    enterBuild();
    vi.restoreAllMocks();
  });

  it("says Drop to import while a file is dragged over the window", () => {
    expect(drag("dragenter").defaultPrevented).toBe(true);
    expect(screen.getByText("Drop to import")).toBeInTheDocument();
    drag("dragenter");
    drag("dragleave");
    expect(screen.getByText("Drop to import")).toBeInTheDocument();
    drag("dragleave");
    expect(screen.queryByText("Drop to import")).not.toBeInTheDocument();
  });

  it("replaces the net with the first dropped file", async () => {
    drag("dragenter");
    const drop = drag("drop", [npnFile(NEW), new File(["not a net"], "second.npn")]);
    expect(drop.defaultPrevented).toBe(true);
    expect(screen.queryByText("Drop to import")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(names()).toEqual(["dropped"]));
    expect(track).toHaveBeenCalledExactlyOnceWith("Import", { format: "npn", method: "drop" });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("changes nothing in Simulate, but still keeps the browser from opening the file", async () => {
    enterSimulate();
    track.mockClear();
    expect(drag("dragenter").defaultPrevented).toBe(true);
    expect(screen.queryByText("Drop to import")).not.toBeInTheDocument();
    const over = drag("dragover");
    expect(over.defaultPrevented).toBe(true);
    expect((over as DragEvent).dataTransfer?.dropEffect).toBe("none");

    expect(drag("drop", [npnFile(NEW)]).defaultPrevented).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(names()).toEqual(["old"]);
    expect(track).not.toHaveBeenCalled();
  });

  it("shows the import error for a bad file", async () => {
    drag("drop", [new File(["<pnml><net"], "bad.pnml")]);
    await vi.waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/^Import failed: /)),
    );
    expect(names()).toEqual(["old"]);
    expect(track).toHaveBeenCalledExactlyOnceWith("Import refused", {
      format: "pnml",
      reason: "invalid",
    });
  });

  it("leaves drags without a file to the page", () => {
    expect(drag("dragenter", [], ["text/plain"]).defaultPrevented).toBe(false);
    expect(drag("drop", [], ["text/plain"]).defaultPrevented).toBe(false);
    expect(screen.queryByText("Drop to import")).not.toBeInTheDocument();
  });
});
