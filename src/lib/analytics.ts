const TRACKER_SRC = "https://stats.anikiej.com/script.js";
const WEBSITE_ID = "6bca947a-5d59-48a5-bf68-6d98d218bdf8";
const PRODUCTION_HOST = "petrinet.anikiej.com";

/**
 * Visitor analytics (Umami, self-hosted at stats.anikiej.com). It is privacy-friendly and
 * cookieless, and it counts pageviews only in v1.
 *
 * `init()` loads the Umami tracker script, which captures pageviews automatically. The host gate
 * keeps dev / preview / docker-local runs silent: the script loads on the production domain only.
 *
 * Curated custom events (Export / Import / Enter Simulate / Open Analytics, plus outbound-link
 * tracking) are deferred. See PLAN.md → Future Updates. They land as a static `track()` here.
 */
export class Analytics {
  static init(): void {
    if (window.location.hostname !== PRODUCTION_HOST) return;
    const script: HTMLScriptElement = document.createElement("script");
    script.defer = true;
    script.src = TRACKER_SRC;
    script.dataset.websiteId = WEBSITE_ID;
    document.head.appendChild(script);
  }
}
