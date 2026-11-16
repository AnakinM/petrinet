// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { PnmlParseError } from "@/codec/pnml";
import type { PetriNet } from "@/domain/types";
import { Analytics } from "@/lib/analytics";
import { ImageFile, NetFile, NetImportError, NpnFile, PnmlFile } from "@/lib/download";
import { useNetStore } from "@/store/netStore";
import { useNoticeStore } from "@/store/noticeStore";
import { useSimStore } from "@/store/simStore";
import {
  copyImage,
  enterBuild,
  enterSimulate,
  exportNet,
  exportPng,
  exportPnml,
  exportSvg,
  exportTikz,
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
    vi.spyOn(ImageFile, "saveTikz").mockImplementation(() => {});
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
    ["tikz", exportTikz],
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

describe("toolbarActions picture exports", () => {
  beforeEach(() => {
    vi.spyOn(Analytics, "track").mockImplementation(() => {});
    useNetStore.getState().setNet(NET);
    useNoticeStore.setState({ message: null });
  });

  afterEach(() => {
    enterBuild();
    vi.restoreAllMocks();
  });

  it("draws the live marking in Simulate", () => {
    const saveTikz = vi.spyOn(ImageFile, "saveTikz").mockImplementation(() => {});
    enterSimulate();
    useSimStore.setState({ marking: { p1: 5 } });
    exportTikz();
    expect(saveTikz.mock.calls[0]?.[0].places[0]?.tokens).toBe(5);
  });

  it("copies the picture, counts it and confirms it in the notice", async () => {
    vi.spyOn(ImageFile, "canCopy").mockReturnValue(true);
    const copy = vi.spyOn(ImageFile, "copyPng").mockResolvedValue();
    copyImage();
    expect(copy).toHaveBeenCalledExactlyOnceWith(NET);
    expect(Analytics.track).toHaveBeenCalledExactlyOnceWith("Export", { format: "clipboard" });
    await vi.waitFor(() =>
      expect(useNoticeStore.getState().message).toBe("Picture copied to the clipboard."),
    );
  });

  it("says so when the copy fails", async () => {
    vi.spyOn(ImageFile, "canCopy").mockReturnValue(true);
    vi.spyOn(ImageFile, "copyPng").mockRejectedValue(new Error("denied"));
    copyImage();
    await vi.waitFor(() =>
      expect(useNoticeStore.getState().message).toBe(
        "The picture could not be copied. Use PNG image instead.",
      ),
    );
  });

  it("explains when the browser cannot copy pictures", () => {
    vi.spyOn(ImageFile, "canCopy").mockReturnValue(false);
    const copy = vi.spyOn(ImageFile, "copyPng");
    copyImage();
    expect(copy).not.toHaveBeenCalled();
    expect(Analytics.track).not.toHaveBeenCalled();
    expect(useNoticeStore.getState().message).toBe(
      "Your browser cannot copy pictures. Use PNG image instead.",
    );
  });
});
