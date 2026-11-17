import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { NpnCodec } from "@/codec/npn";
import type { PetriNet } from "@/domain/types";
import type { Analytics } from "@/lib/analytics";
import { netHistory, useNetStore } from "@/store/netStore";

/** p1 (0,0) → t1 (48,0), one arc with both endpoints in the pair. */
const NET: PetriNet = {
  places: [{ id: "p1", name: "P1", tokens: 1, position: { x: 0, y: 0 } }],
  transitions: [{ id: "t1", name: "T1", position: { x: 48, y: 0 } }],
  arcs: [
    {
      id: "a1",
      source: "p1",
      target: "t1",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        { x: 20, y: 0 },
        { x: 28, y: 0 },
      ],
    },
  ],
};

const { copy, paste, select } = useNetStore.getState();
const pastedXs = (): number[] =>
  useNetStore
    .getState()
    .net.places.filter((p) => p.id !== "p1")
    .map((p) => p.position.x)
    .sort((a, b) => a - b);

describe("netStore copy/paste", () => {
  beforeEach(() => {
    useNetStore.getState().setNet(structuredClone(NET));
    useNetStore.setState({ clipboard: null, _pasteCount: 0 });
  });

  it("copies the induced subgraph and pastes a new, selected cluster", () => {
    select({ nodes: ["p1", "t1"], edges: [] });
    copy();
    paste();
    const s = useNetStore.getState();
    expect(s.net.places).toHaveLength(2);
    expect(s.net.transitions).toHaveLength(2);
    expect(s.net.arcs).toHaveLength(2); // a1 induced → pasted
    expect(s.selection.nodes).toHaveLength(2);
    expect(s.selection.edges).toHaveLength(1);
    expect(s.selection.nodes).not.toContain("p1"); // the paste, not the originals
  });

  it("cascades the offset 24 / 48 / 72 on repeated paste", () => {
    select({ nodes: ["p1"], edges: [] });
    copy();
    paste();
    paste();
    paste();
    expect(pastedXs()).toEqual([24, 48, 72]);
  });

  it("resets the cascade on a fresh copy", () => {
    select({ nodes: ["p1"], edges: [] });
    copy();
    paste(); // 24
    paste(); // 48
    select({ nodes: ["p1"], edges: [] }); // re-select the original
    copy(); // reset
    paste(); // 24 again, not 72
    expect(pastedXs()).toEqual([24, 24, 48]);
  });

  it("no-ops copy with an empty selection, keeping any existing clipboard", () => {
    select({ nodes: ["p1"], edges: [] });
    copy(); // clipboard holds p1
    select({ nodes: [], edges: [] });
    copy(); // empty selection → no-op, clipboard retained
    paste();
    expect(useNetStore.getState().net.places).toHaveLength(2);
  });

  it("no-ops paste with an empty clipboard", () => {
    paste();
    expect(useNetStore.getState().net.places).toHaveLength(1);
  });

  it("copies nothing for a lone selected arc (no node endpoints)", () => {
    select({ nodes: [], edges: ["a1"] });
    copy();
    paste();
    expect(useNetStore.getState().net.places).toHaveLength(1);
    expect(useNetStore.getState().net.arcs).toHaveLength(1);
  });
});

describe("netStore Edit net usage event", () => {
  /** Fresh store and Analytics modules, so the once-per-page-load memory starts empty. */
  async function load(): Promise<{
    track: MockInstance<typeof Analytics.track>;
    store: typeof useNetStore;
    history: typeof netHistory;
  }> {
    vi.resetModules();
    const analytics = await import("@/lib/analytics");
    const track = vi.spyOn(analytics.Analytics, "track").mockImplementation(() => {});
    const fresh = await import("@/store/netStore");
    return { track, store: fresh.useNetStore, history: fresh.netHistory };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is not sent by import, New, undo or redo", async () => {
    const { track, store, history } = await load();
    store.getState().setNet(structuredClone(NET));
    store.getState().setNet({ places: [], transitions: [], arcs: [] });
    history.undo();
    history.redo();
    expect(track).not.toHaveBeenCalled();
  });

  it("is sent once, on the first add of a place, transition or arc", async () => {
    const { track, store } = await load();
    store.getState().setNet(structuredClone(NET));
    store.getState().addPlace({ x: 100, y: 0 });
    expect(track).toHaveBeenCalledExactlyOnceWith("Edit net");
    store.getState().addTransition({ x: 200, y: 0 });
    store.getState().connect("t1", "p1");
    expect(track).toHaveBeenCalledTimes(1);
  });

  it("counts a paste", async () => {
    const { track, store } = await load();
    store.getState().setNet(structuredClone(NET));
    store.getState().select({ nodes: ["p1"], edges: [] });
    store.getState().copy();
    store.getState().paste();
    expect(track).toHaveBeenCalledExactlyOnceWith("Edit net");
  });

  it("counts an arc, but not a refused arc", async () => {
    const { track, store } = await load();
    store.getState().setNet(structuredClone(NET));
    store.getState().connect("p1", "p1");
    expect(track).not.toHaveBeenCalled();
    store.getState().connect("t1", "p1");
    expect(track).toHaveBeenCalledExactlyOnceWith("Edit net");
  });
});

describe("netStore with an imported .npn net", () => {
  it("still exports it byte-identically after Simulate, an undone edit and a redo", () => {
    // A course tool sample with one arc's labelPosition written before its points.
    const text = readFileSync(
      new URL("../codec/fixtures/npn/class-tool-arc-label-first.npn", import.meta.url),
      "utf8",
    );
    const exported = (): string => NpnCodec.BOM + NpnCodec.serialize(useNetStore.getState().net);
    const { setNet, setMode, addPlace } = useNetStore.getState();

    setNet(NpnCodec.parse(text));
    setMode("simulate");
    setMode("build");
    addPlace({ x: 900, y: 0 });
    netHistory.undo();
    expect(exported()).toBe(text);

    netHistory.redo();
    netHistory.undo();
    expect(exported()).toBe(text);
  });
});
