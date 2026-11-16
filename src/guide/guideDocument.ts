import { PRERENDER_MARK } from "@/guide/prerenderMark";

/** The address of the guide page. */
export const GUIDE_URL = "https://petrinet.anikiej.com/guide";

/** The guide's browser title, also used for the Open Graph and Twitter titles. */
export const GUIDE_TITLE = "What is a Petri net? Guide and examples | PetriNet Editor";

/** The guide's headline in its structured data: the title without the site name. */
export const GUIDE_HEADLINE = "What is a Petri net? Guide and examples";

/** The guide's description for search results and link previews. */
export const GUIDE_DESCRIPTION =
  "Learn what a Petri net is, how places, transitions and tokens work, and how firing moves " +
  "tokens. Then build, simulate and analyse your first net step by step.";

/** The head tags the guide rewrites: how the tag starts, which attribute, and its new value. */
const HEAD_ATTRIBUTES: readonly (readonly [string, string, string])[] = [
  ['<link rel="canonical"', "href", GUIDE_URL],
  ['<meta property="og:type"', "content", "article"],
  ['<meta property="og:url"', "content", GUIDE_URL],
  ['<meta name="description"', "content", GUIDE_DESCRIPTION],
  ['<meta property="og:title"', "content", GUIDE_TITLE],
  ['<meta property="og:description"', "content", GUIDE_DESCRIPTION],
  ['<meta name="twitter:title"', "content", GUIDE_TITLE],
  ['<meta name="twitter:description"', "content", GUIDE_DESCRIPTION],
];

/** The parts of the home page's `WebSite` structured data that the guide reuses. */
interface WebSiteData {
  name: string;
  url: string;
  author: unknown;
}

/**
 * Builds the guide's own HTML file from the editor's built `index.html`. The build renders the
 * guide to a string and passes it in. This class swaps the head tags that describe the page and
 * puts the guide inside the root element, so a crawler reads the guide without running a script.
 *
 * Every swap must find its tag. A missing tag throws, so the build fails instead of shipping a
 * guide page that still claims to be the home page.
 */
export class GuideDocument {
  /** The guide page: `indexHtml` with the guide's head tags and `guideHtml` inside the root. */
  static build(indexHtml: string, guideHtml: string): string {
    let html = GuideDocument._swap(indexHtml, /<title>[^<]*<\/title>/, "<title>", () => {
      return `<title>${GuideDocument._escape(GUIDE_TITLE)}</title>`;
    });
    for (const [start, attribute, value] of HEAD_ATTRIBUTES) {
      html = GuideDocument._setAttribute(html, start, attribute, value);
    }
    html = GuideDocument._swap(
      html,
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      "the JSON-LD block",
      (_match, siteJson) => {
        const article = GuideDocument._article(GuideDocument._readWebSite(siteJson));
        return `<script type="application/ld+json">${JSON.stringify(article)}</script>`;
      },
    );
    // The home page's fallback inside the root holds no nested div, so the first `</div>` closes it.
    return GuideDocument._swap(html, /<div id="root">[\s\S]*?<\/div>/, "the root element", () => {
      return `<div id="root" data-prerendered="${PRERENDER_MARK}">${guideHtml}</div>`;
    });
  }

  /** The `TechArticle` that describes the guide, written by the site's author, part of the site. */
  private static _article(site: WebSiteData): Record<string, unknown> {
    return {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: GUIDE_HEADLINE,
      description: GUIDE_DESCRIPTION,
      url: GUIDE_URL,
      author: site.author,
      isPartOf: { "@type": "WebSite", name: site.name, url: site.url },
    };
  }

  /** Read the home page's `WebSite` block, or throw if the block is something else. */
  private static _readWebSite(json: string): WebSiteData {
    const data: unknown = JSON.parse(json);
    if (
      typeof data === "object" &&
      data !== null &&
      "@type" in data &&
      data["@type"] === "WebSite" &&
      "name" in data &&
      typeof data.name === "string" &&
      "url" in data &&
      typeof data.url === "string" &&
      "author" in data
    ) {
      return { name: data.name, url: data.url, author: data.author };
    }
    throw new Error("Guide prerender: the JSON-LD block in index.html is not a WebSite");
  }

  /** Set `attribute` to `value` on the tag that begins with `start` (the attribute follows it). */
  private static _setAttribute(
    html: string,
    start: string,
    attribute: string,
    value: string,
  ): string {
    const pattern = new RegExp(`(${start.replaceAll(" ", "\\s+")}\\s+${attribute}=")[^"]*"`);
    return GuideDocument._swap(html, pattern, `${start}>`, (_match, found) => {
      return `${found}${GuideDocument._escape(value)}"`;
    });
  }

  /** Replace the first match of `pattern`, or throw a clear error that names the `missing` tag. */
  private static _swap(
    html: string,
    pattern: RegExp,
    missing: string,
    replace: (match: string, group: string) => string,
  ): string {
    if (!pattern.test(html)) {
      throw new Error(`Guide prerender: ${missing} is missing from index.html`);
    }
    return html.replace(pattern, replace);
  }

  /** Escape text for an HTML attribute value or element content. */
  private static _escape(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
}
