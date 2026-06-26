import { init as plausibleInit } from "@plausible-analytics/tracker";

/**
 * Visitor analytics (Plausible) — privacy-friendly, cookieless, pageviews only in v1.
 *
 * `init()` enables automatic pageview capture for the production domain. The tracker excludes
 * localhost by default (`captureOnLocalhost` stays `false`), so dev / preview / docker-local
 * runs stay silent without any host gate here.
 *
 * Curated custom events (Export / Import / Enter Simulate / Open Analytics, plus outbound-link
 * tracking) are deferred — see PLAN.md → Future Updates. They land as a static `track()` here.
 */
export class Analytics {
  static init(): void {
    plausibleInit({ domain: "petrinet.anikiej.com" });
  }
}
