import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import type { Analytics } from "@/lib/analytics";
import type { useAnalyticsStore } from "@/store/analyticsStore";

/** Load fresh copies of the store and the Analytics class, with `track` spied on. */
async function load(): Promise<{
  track: MockInstance<typeof Analytics.track>;
  store: typeof useAnalyticsStore;
}> {
  const analytics = await import("@/lib/analytics");
  const track = vi.spyOn(analytics.Analytics, "track").mockImplementation(() => {});
  const fresh = await import("@/store/analyticsStore");
  return { track, store: fresh.useAnalyticsStore };
}

describe("analyticsStore usage event", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Open Analysis panel when the visitor opens the panel, not when closing it", async () => {
    const { track, store } = await load();
    store.getState().toggle();
    expect(track).toHaveBeenCalledExactlyOnceWith("Open Analysis panel");
    store.getState().toggle();
    store.getState().close();
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("does not send it when the panel is restored as open at page load", async () => {
    localStorage.setItem(
      "petrinet.analytics.v1",
      JSON.stringify({ open: true, width: 360, activeTab: "invariants" }),
    );
    const { track, store } = await load();
    expect(store.getState().open).toBe(true);
    expect(track).not.toHaveBeenCalled();
  });
});
