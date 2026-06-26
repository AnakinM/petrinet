import type { StoreApi } from "zustand";
import type { PetriNet } from "@/domain/types";
import type { NetState, Viewport } from "@/store/netStore";

interface Saved {
  net: PetriNet;
  viewport: Viewport | null;
}

/**
 * Debounced `localStorage` persistence of the working net and viewport, restored on load.
 * The net is stored as the plain domain object (JSON round-trips it losslessly); export
 * still goes through {@link NpnCodec} for byte-faithful `.npn`. A corrupt or absent entry
 * loads as `null` rather than throwing, so the app falls back to its default net.
 */
export class Autosave {
  private static readonly KEY = "petrinet.autosave.v1";
  private static readonly DEBOUNCE_MS = 500;

  /** Read the saved net + viewport, or `null` if absent/unparseable/structurally invalid. */
  static load(): Saved | null {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(Autosave.KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as Saved;
      const net = data?.net;
      if (
        !net ||
        !Array.isArray(net.places) ||
        !Array.isArray(net.transitions) ||
        !Array.isArray(net.arcs)
      ) {
        return null;
      }
      return { net, viewport: data.viewport ?? null };
    } catch {
      return null;
    }
  }

  /** Begin saving on every store change (debounced). Returns an unsubscribe function. */
  static attach(store: StoreApi<NetState>): () => void {
    if (typeof localStorage === "undefined") return () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    return store.subscribe(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const { net, viewport } = store.getState();
        localStorage.setItem(Autosave.KEY, JSON.stringify({ net, viewport }));
      }, Autosave.DEBOUNCE_MS);
    });
  }
}
