import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { NetAnalysis } from "@/domain/analysis/netAnalysis";
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

describe("analyticsStore results across closing and opening", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A store with the panel open and the full analysis run. */
  async function analysed(): Promise<{
    store: typeof useAnalyticsStore;
    net: typeof import("@/store/netStore").useNetStore;
  }> {
    const { store } = await load();
    const { useNetStore } = await import("@/store/netStore");
    store.getState().toggle();
    store.getState().reanalyze();
    return { store, net: useNetStore };
  }

  it("keeps the full results when the panel closes and opens with no edit", async () => {
    const { store } = await analysed();
    store.getState().toggle();
    store.getState().toggle();
    expect(store.getState().result?.placeBounds).not.toBeNull();
    expect(store.getState().stale).toBe(false);
  });

  it("keeps the full results through close() too", async () => {
    const { store } = await analysed();
    store.getState().close();
    store.getState().toggle();
    expect(store.getState().result?.placeBounds).not.toBeNull();
    expect(store.getState().stale).toBe(false);
  });

  it("keeps the full results after a cosmetic edit made while closed", async () => {
    const { store, net } = await analysed();
    store.getState().toggle();
    const place = net.getState().net.places[0];
    net
      .getState()
      .moveNodes([{ id: place.id, position: { x: place.position.x + 40, y: place.position.y } }]);
    store.getState().toggle();
    expect(store.getState().result?.placeBounds).not.toBeNull();
    expect(store.getState().stale).toBe(false);
  });

  it("drops the full results and turns stale after a structural edit made while closed", async () => {
    const { store, net } = await analysed();
    store.getState().toggle();
    const id = net.getState().net.places[0].id;
    net.getState().setTokens(id, net.getState().net.places[0].tokens + 3);
    store.getState().toggle();
    expect(store.getState().result).not.toBeNull();
    expect(store.getState().result?.placeBounds).toBeNull();
    expect(store.getState().stale).toBe(true);
  });

  it("shows the quick results of the current net after the net is replaced while closed", async () => {
    const { store, net } = await analysed();
    store.getState().toggle();
    net.getState().setNet({
      places: [{ id: "Q1", name: "Q1", tokens: 2, position: { x: 0, y: 0 } }],
      transitions: [{ id: "u1", name: "u1", position: { x: 80, y: 0 } }],
      arcs: [],
    });
    store.getState().toggle();
    expect(store.getState().result).toEqual(
      NetAnalysis.analyze(net.getState().net, { behavioral: false }),
    );
    expect(store.getState().result?.placeBounds).toBeNull();
    expect(store.getState().stale).toBe(true);
  });

  it("stays at not run when no full analysis ever ran", async () => {
    const { store } = await load();
    const { useNetStore } = await import("@/store/netStore");
    store.getState().toggle();
    store.getState().toggle();
    useNetStore.getState().setTokens(useNetStore.getState().net.places[0].id, 9);
    store.getState().toggle();
    expect(store.getState().result?.placeBounds).toBeNull();
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
