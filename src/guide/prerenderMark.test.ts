// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PRERENDER_MARK, PrerenderMark } from "@/guide/prerenderMark";

function rootWith(html: string): HTMLElement {
  const root = document.createElement("div");
  root.id = "root";
  root.innerHTML = html;
  return root;
}

describe("PrerenderMark.isOn", () => {
  it("is true for a root that the build marked as holding the guide", () => {
    const root = rootWith("<main>Guide</main>");
    root.dataset.prerendered = PRERENDER_MARK;
    expect(PrerenderMark.isOn(root)).toBe(true);
  });

  it("is false for the home page's root, which only holds the static fallback", () => {
    expect(PrerenderMark.isOn(rootWith("<h1>PetriNet Editor</h1>"))).toBe(false);
  });
});
