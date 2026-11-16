const TRACKER_SRC = "https://stats.anikiej.com/script.js";
const WEBSITE_ID = "6bca947a-5d59-48a5-bf68-6d98d218bdf8";
const PRODUCTION_HOST = "petrinet.anikiej.com";

/**
 * Visitor analytics (Umami, self-hosted at stats.anikiej.com). It is privacy-friendly and cookieless.
 *
 * `init()` loads the Umami tracker script, which captures pageviews automatically. The host gate
 * keeps dev / preview / docker-local runs silent: the script loads on the production domain only.
 *
 * `track()` sends a named usage event (Export, Import, Enter simulation and so on). An event never
 * carries any part of the net or any personal data. Umami limits a name to 50 characters and a
 * string value to 500. When the tracker is absent (not loaded yet, blocked, or not production) the
 * call does nothing, and it never throws, so an action never fails or waits because of analytics.
 */
export class Analytics {
  /** Event names already sent through {@link trackOnce} in this page load. */
  private static readonly _sentOnce = new Set<string>();

  static init(): void {
    if (window.location.hostname !== PRODUCTION_HOST) return;
    const script: HTMLScriptElement = document.createElement("script");
    script.defer = true;
    script.src = TRACKER_SRC;
    script.dataset.websiteId = WEBSITE_ID;
    document.head.appendChild(script);
  }

  /** Send the usage event `name` with optional `data`. Silent when the tracker is absent. */
  static track(name: string, data?: Record<string, string>): void {
    try {
      globalThis.window?.umami?.track(name, data);
    } catch {
      // A broken tracker must never break the visitor's action.
    }
  }

  /** Send the usage event `name` the first time it is asked for in this page load only. */
  static trackOnce(name: string): void {
    if (Analytics._sentOnce.has(name)) return;
    Analytics._sentOnce.add(name);
    Analytics.track(name);
  }
}
