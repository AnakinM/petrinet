// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./useIsMobile";

describe("useIsMobile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns false when matchMedia is unavailable (jsdom / SSR)", () => {
    // The guard is what keeps every other component test on the desktop layout.
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("reflects a matching media query", () => {
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reports desktop when the query does not match", () => {
    const mql = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mql),
    );
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
