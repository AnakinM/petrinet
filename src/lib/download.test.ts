// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PetriNet } from "@/domain/types";
import { ImageFile, NetFile, type NetFormat, NetImportError } from "@/lib/download";

/** Run `NetFile.open()` as if the visitor picked a file named `name` that holds `text`. */
function openFile(name: string, text: string): Promise<{ format: NetFormat; net: PetriNet }> {
  const input = document.createElement("input");
  vi.spyOn(document, "createElement").mockReturnValueOnce(input);
  vi.spyOn(input, "click").mockImplementation(() => {
    Object.defineProperty(input, "files", { value: [new File([text], name)] });
    input.dispatchEvent(new Event("change"));
  });
  return NetFile.open();
}

describe("NetFile.open import errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["bad.npn", "this is not JSON", "npn"],
    ["bad.pnml", "<pnml><net", "pnml"],
  ])("rejects %s with a NetImportError for its format", async (name, text, format) => {
    const error = await openFile(name, text).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetImportError);
    expect((error as NetImportError).format).toBe(format);
    expect((error as NetImportError).reason).toBe("invalid");
  });

  it("carries the PNML refusal reason", async () => {
    const coloured =
      '<pnml><net id="n" type="http://www.pnml.org/version-2009/grammar/symmetricnet"/></pnml>';
    const error = await openFile("coloured.pnml", coloured).catch((e: unknown) => e);
    expect((error as NetImportError).reason).toBe("net-type");
  });
});

describe("ImageFile pictures", () => {
  const NET: PetriNet = {
    places: [{ id: "p1", name: "P1", tokens: 1, position: { x: 0, y: 0 } }],
    transitions: [],
    arcs: [],
  };

  beforeEach(() => {
    // jsdom has no object URLs; the picture code only needs a string back.
    URL.createObjectURL = vi.fn(() => "blob:picture");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the TikZ picture as net.tex", () => {
    const anchor = document.createElement("a");
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);
    const click = vi.spyOn(anchor, "click").mockImplementation(() => {});
    ImageFile.saveTikz(NET);
    expect(anchor.download).toBe("net.tex");
    expect(click).toHaveBeenCalledOnce();
  });

  it("knows when the browser cannot copy pictures", () => {
    vi.stubGlobal("ClipboardItem", undefined);
    expect(ImageFile.canCopy()).toBe(false);
  });

  it("makes the clipboard item at once, with a promise for the PNG (Safari needs this)", () => {
    const items: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(data: Record<string, unknown>) {
          items.push(data);
        }
      },
    );
    const write = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { write } });
    expect(ImageFile.canCopy()).toBe(true);

    void ImageFile.copyPng(NET);
    expect(items).toHaveLength(1);
    expect(items[0]?.["image/png"]).toBeInstanceOf(Promise);
    expect(write).toHaveBeenCalledOnce();
  });
});
