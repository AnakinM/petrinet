// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextClipboard } from "@/lib/clipboard";

/** A stand-in for the browser's `ClipboardItem`, which jsdom lacks: it keeps the parts it was given. */
class FakeClipboardItem {
  constructor(readonly parts: Record<string, Blob>) {}
}

describe("TextClipboard.htmlTable", () => {
  it("turns the first line into a header row and the rest into body rows", () => {
    const html = TextClipboard.htmlTable("\tT1\tT2\nP1\t-1\t1\nP2\t1\t-1");
    expect(html).toContain("<thead><tr>");
    expect(html.match(/<th /g)).toHaveLength(3);
    expect(html.match(/<td /g)).toHaveLength(6);
    expect(html).toMatch(/<td [^>]*>-1<\/td>/);
  });

  it("escapes the characters HTML treats as markup", () => {
    const html = TextClipboard.htmlTable('Name\n<b>&"x"');
    expect(html).toContain("&lt;b&gt;&amp;&quot;x&quot;");
    expect(html).not.toContain("<b>");
  });
});

describe("TextClipboard.write", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("puts both plain text and HTML on the clipboard when the browser can hold both", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
    vi.stubGlobal("navigator", { clipboard: { write, writeText: vi.fn() } });
    await TextClipboard.writeTable("a\tb\n1\t2");
    const [[items]] = write.mock.calls as [[FakeClipboardItem[]]];
    expect(Object.keys(items[0].parts)).toEqual(["text/plain", "text/html"]);
    expect(await items[0].parts["text/plain"].text()).toBe("a\tb\n1\t2");
    expect(await items[0].parts["text/html"].text()).toContain("<table");
  });

  it("falls back to plain text when the browser cannot hold several types", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await TextClipboard.writeTable("a\tb");
    expect(writeText).toHaveBeenCalledWith("a\tb");
  });

  it("rejects when the page has no clipboard access", async () => {
    vi.stubGlobal("navigator", {});
    await expect(TextClipboard.write("text")).rejects.toThrow("not available");
  });
});
