// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GUIDE_DESCRIPTION,
  GUIDE_HEADLINE,
  GUIDE_TITLE,
  GUIDE_URL,
  GuideDocument,
} from "@/guide/guideDocument";

/**
 * The real page template, so the test breaks when `index.html` drifts from what the build expects.
 * The path is relative to the project root, where Vitest runs. Under jsdom `import.meta.url` is not
 * a file URL.
 */
const INDEX_HTML = readFileSync("index.html", "utf-8");
const GUIDE_BODY = '<div class="guide"><h1>Guide</h1><p>Places hold tokens.</p></div>';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function attribute(doc: Document, selector: string, name: string): string | null {
  return doc.querySelector(selector)?.getAttribute(name) ?? null;
}

function jsonLd(doc: Document): Record<string, unknown>[] {
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]');
  return [...blocks].map((block) => JSON.parse(block.textContent ?? ""));
}

describe("GuideDocument.build", () => {
  const home = parse(INDEX_HTML);
  const guide = parse(GuideDocument.build(INDEX_HTML, GUIDE_BODY));

  it("gives the guide its own title, description, canonical link and og:url", () => {
    expect(guide.title).toBe(GUIDE_TITLE);
    expect(attribute(guide, 'meta[name="description"]', "content")).toBe(GUIDE_DESCRIPTION);
    expect(attribute(guide, 'link[rel="canonical"]', "href")).toBe(GUIDE_URL);
    expect(attribute(guide, 'meta[property="og:url"]', "content")).toBe(GUIDE_URL);
  });

  it("marks the guide as an article for Open Graph", () => {
    expect(attribute(home, 'meta[property="og:type"]', "content")).toBe("website");
    expect(attribute(guide, 'meta[property="og:type"]', "content")).toBe("article");
  });

  it("swaps the Open Graph and Twitter titles and descriptions", () => {
    expect(attribute(guide, 'meta[property="og:title"]', "content")).toBe(GUIDE_TITLE);
    expect(attribute(guide, 'meta[name="twitter:title"]', "content")).toBe(GUIDE_TITLE);
    expect(attribute(guide, 'meta[property="og:description"]', "content")).toBe(GUIDE_DESCRIPTION);
    expect(attribute(guide, 'meta[name="twitter:description"]', "content")).toBe(GUIDE_DESCRIPTION);
  });

  it("keeps the site name and author tags of the home page", () => {
    for (const [selector, name] of [
      ['meta[property="og:site_name"]', "content"],
      ['meta[name="application-name"]', "content"],
      ['meta[name="author"]', "content"],
    ]) {
      expect(attribute(guide, selector, name)).toBe(attribute(home, selector, name));
    }
  });

  it("replaces the WebSite JSON-LD with a TechArticle that is part of the site", () => {
    const [site] = jsonLd(home);
    expect(site["@type"]).toBe("WebSite");

    const blocks = jsonLd(guide);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: GUIDE_HEADLINE,
      description: GUIDE_DESCRIPTION,
      url: GUIDE_URL,
      author: site.author,
      isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    });
  });

  it("puts the guide inside the root in place of the home page's fallback", () => {
    const root = guide.getElementById("root");
    expect(root?.innerHTML).toBe(GUIDE_BODY);
    expect(root && GuideDocument.isPrerendered(root)).toBe(true);
    // The home description lived in the head tags and in the fallback paragraph. None is left.
    const homeDescription = attribute(home, 'meta[name="description"]', "content") ?? "";
    expect(homeDescription).not.toBe("");
    expect(guide.documentElement.outerHTML).not.toContain(homeDescription);
  });

  it("keeps everything after the root, such as the app script", () => {
    expect(guide.querySelectorAll("body > script")).toHaveLength(
      home.querySelectorAll("body > script").length,
    );
  });

  it("fails with a clear error when a tag it must swap is missing", () => {
    const withoutCanonical = INDEX_HTML.replace(/<link rel="canonical"[^>]*>/, "");
    expect(() => GuideDocument.build(withoutCanonical, GUIDE_BODY)).toThrow(
      'Guide prerender: <link rel="canonical"> is missing from index.html',
    );
  });
});

describe("GuideDocument.isPrerendered", () => {
  it("is false for the home page's root, which only holds the static fallback", () => {
    const root = parse(INDEX_HTML).getElementById("root");
    expect(root?.childElementCount).toBeGreaterThan(0);
    expect(root && GuideDocument.isPrerendered(root)).toBe(false);
  });
});
