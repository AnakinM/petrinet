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

describe("analyticsStore persisted state", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens on the default tab and width when nothing is stored", async () => {
    const { store } = await load();
    expect(store.getState().activeTab).toBe("invariants");
    expect(store.getState().width).toBe(400);
  });

  it("keeps a stored width and the new Reachability tab", async () => {
    localStorage.setItem(
      "petrinet.analytics.v1",
      JSON.stringify({ open: false, width: 360, activeTab: "reachability" }),
    );
    const { store } = await load();
    expect(store.getState().width).toBe(360);
    expect(store.getState().activeTab).toBe("reachability");
  });

  it("ignores a stored tab that does not exist", async () => {
    localStorage.setItem(
      "petrinet.analytics.v1",
      JSON.stringify({ open: false, width: "wide", activeTab: "deadlocks" }),
    );
    const { store } = await load();
    expect(store.getState().activeTab).toBe("invariants");
    expect(store.getState().width).toBe(400);
  });
});

describe("analyticsStore stale flag", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the results stale after an edit only when a full analysis had run", async () => {
    const { store } = await load();
    const { useNetStore } = await import("@/store/netStore");
    const id = useNetStore.getState().net.places[0].id;
    store.getState().toggle();

    useNetStore.getState().setTokens(id, 5);
    expect(store.getState().stale).toBe(false);

    store.getState().reanalyze();
    expect(store.getState().result?.placeBounds).not.toBeNull();
    useNetStore.getState().setTokens(id, 6);
    expect(store.getState().stale).toBe(true);
    // The old full results belong to the old net, so they are dropped.
    expect(store.getState().result?.placeBounds).toBeNull();

    store.getState().reanalyze();
    expect(store.getState().stale).toBe(false);
  });
});

describe("analyticsStore with blocked storage", () => {
  const storage = globalThis.localStorage;
  const denied = (): never => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };

  afterEach(() => {
    vi.stubGlobal("localStorage", storage);
    vi.restoreAllMocks();
  });

  it("starts with the defaults and keeps working when getItem and setItem throw", async () => {
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    vi.resetModules();
    const { store } = await load();
    expect(store.getState()).toMatchObject({ open: false, width: 400, activeTab: "invariants" });

    store.getState().toggle();
    store.getState().setActiveTab("structure");
    store.getState().commitWidth();
    expect(store.getState()).toMatchObject({ open: true, activeTab: "structure" });
  });
});
