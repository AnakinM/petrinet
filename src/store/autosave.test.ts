import { afterEach, describe, expect, it, vi } from "vitest";
import { create, type StoreApi } from "zustand";
import { Autosave } from "@/store/autosave";
import type { NetState } from "@/store/netStore";

const STORAGE = globalThis.localStorage;
const denied = (): never => {
  throw new DOMException("The operation is insecure.", "SecurityError");
};

describe("Autosave with blocked storage", () => {
  afterEach(() => {
    vi.stubGlobal("localStorage", STORAGE);
    vi.useRealTimers();
  });

  it("loads nothing and saves without throwing when getItem and setItem throw", () => {
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    expect(Autosave.load()).toBeNull();

    vi.useFakeTimers();
    const store = create<Pick<NetState, "net" | "viewport">>()(() => ({
      net: { places: [], transitions: [], arcs: [] },
      viewport: null,
    }));
    // Autosave reads only `net` and `viewport`.
    const stop = Autosave.attach(store as unknown as StoreApi<NetState>);
    store.setState({ viewport: { x: 1, y: 2, zoom: 1 } });
    expect(() => vi.runAllTimers()).not.toThrow();
    stop();
  });

  it("starts the editor's net store with the default net", async () => {
    vi.stubGlobal("localStorage", { getItem: denied, setItem: denied, removeItem: denied });
    vi.resetModules();
    const { useNetStore } = await import("@/store/netStore");
    expect(useNetStore.getState().net.places.length).toBeGreaterThan(0);
  });
});
