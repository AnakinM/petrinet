// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PetriNet } from "@/domain/types";
import { NetFile, type NetFormat, NetImportError } from "@/lib/download";

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
});
