import { beforeEach, describe, expect, it } from "vitest";
import type { PetriNet } from "@/domain/types";
import { useNetStore } from "@/store/netStore";

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
