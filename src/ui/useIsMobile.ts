import { useSyncExternalStore } from "react";

/** Viewport width at or below which the app switches to its touch/mobile layout. */
const MOBILE_QUERY = "(max-width: 767px)";

/**
 * True while the viewport is at or below the mobile breakpoint (≤767px), tracked live via
 * `matchMedia` so a resize / orientation change flips it. Guards the non-browser case (jsdom in
 * unit tests, where `matchMedia` is absent) by reporting `false`, so every component test renders
 * the desktop layout unchanged.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function mediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(MOBILE_QUERY);
}

function subscribe(onChange: () => void): () => void {
  const mql = mediaQuery();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return mediaQuery()?.matches ?? false;
}

/** SSR / test fallback: no window, so never mobile. */
function getServerSnapshot(): boolean {
  return false;
}
