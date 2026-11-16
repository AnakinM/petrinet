// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { PnmlParseError } from "@/codec/pnml";
import type { PetriNet } from "@/domain/types";
import { Analytics } from "@/lib/analytics";
import { ImageFile, NetFile, NetImportError, NpnFile, PnmlFile } from "@/lib/download";
import { useNetStore } from "@/store/netStore";
import {
  enterBuild,
  enterSimulate,
  exportNet,
  exportPng,
  exportPnml,
  exportSvg,
  importNet,
} from "@/ui/toolbarActions";

const NET: PetriNet = {
  places: [{ id: "p1", name: "P1", tokens: 1, position: { x: 0, y: 0 } }],
  transitions: [],
  arcs: [],
};

describe("toolbarActions usage events", () => {
  let track: MockInstance<typeof Analytics.track>;

  beforeEach(() => {
    track = vi.spyOn(Analytics, "track").mockImplementation(() => {});
    vi.spyOn(NpnFile, "save").mockImplementation(() => {});
    vi.spyOn(PnmlFile, "save").mockImplementation(() => {});
    vi.spyOn(ImageFile, "savePng").mockImplementation(() => {});
    vi.spyOn(ImageFile, "saveSvg").mockImplementation(() => {});
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    enterBuild();
    vi.restoreAllMocks();
  });

  it.each([
    ["npn", exportNet],
    ["pnml", exportPnml],
    ["png", exportPng],
    ["svg", exportSvg],
  ])("sends Export with format %s", (format, exportFn) => {
    exportFn();
    expect(track).toHaveBeenCalledExactlyOnceWith("Export", { format });
  });

  it("sends Import with the format and the method after a successful import", async () => {
    vi.spyOn(NetFile, "open").mockResolvedValue({ name: "a.pnml", format: "pnml", net: NET });
    importNet();
    await vi.waitFor(() =>
      expect(track).toHaveBeenCalledExactlyOnceWith("Import", { format: "pnml", method: "button" }),
    );
    expect(useNetStore.getState().net).toBe(NET);
  });

  it("sends Import refused with the format when the codec rejects the file", async () => {
    const error = new NetImportError("npn", new Error("bad file"));
    vi.spyOn(NetFile, "open").mockRejectedValue(error);
    importNet();
    await vi.waitFor(() => expect(window.alert).toHaveBeenCalledWith("Import failed: bad file"));
    expect(track).toHaveBeenCalledExactlyOnceWith("Import refused", {
      format: "npn",
      reason: "invalid",
    });
  });

  it("sends Import refused with the PNML refusal reason", async () => {
    const cause = new PnmlParseError('arc "a1" has the type "inhibitor".', "unsupported-arc");
    vi.spyOn(NetFile, "open").mockRejectedValue(new NetImportError("pnml", cause));
    importNet();
    await vi.waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(track).toHaveBeenCalledExactlyOnceWith("Import refused", {
      format: "pnml",
      reason: "unsupported-arc",
    });
  });

  it("keeps the codec message and cause in a refused import", () => {
    const cause = new PnmlParseError("missing the <pnml> root element.");
    const error = new NetImportError("pnml", cause);
    expect(error.message).toBe(cause.message);
    expect(error.cause).toBe(cause);
    expect(error.format).toBe("pnml");
    expect(error.reason).toBe("invalid");
  });

  it("sends Enter simulation once per switch from Build to Simulate", () => {
    enterSimulate();
    enterSimulate();
    expect(track).toHaveBeenCalledExactlyOnceWith("Enter simulation");
  });
});
