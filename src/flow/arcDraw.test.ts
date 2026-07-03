import { beforeEach, describe, expect, it } from "vitest";
import type { PetriNet, Vec2 } from "@/domain/types";
import { type ArcDraft, useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";
import { ArcDraw } from "./arcDraw";

const ORIGIN: Vec2 = { x: 0, y: 0 };
const NET: PetriNet = {
  places: [
    { id: "p1", name: "p1", tokens: 0, position: { x: 0, y: 0 } },
    { id: "p2", name: "p2", tokens: 0, position: { x: 100, y: 0 } },
  ],
  transitions: [{ id: "t1", name: "t1", position: { x: 50, y: 0 } }],
  arcs: [],
};

function draftFrom(source: string): ArcDraft {
  return { source, bends: [], cursor: ORIGIN, hoverTarget: null };
}

describe("ArcDraw.resolveTap", () => {
  it("drops a bend when the tap misses every node", () => {
    const at: Vec2 = { x: 10, y: 20 };
    expect(ArcDraw.resolveTap(NET, draftFrom("p1"), at, null)).toEqual({ kind: "bend", at });
  });

  it("connects to a valid bipartite target", () => {
    expect(ArcDraw.resolveTap(NET, draftFrom("p1"), ORIGIN, "t1")).toEqual({
      kind: "connect",
      target: "t1",
    });
  });

  it("ignores a tap on the source node itself", () => {
    expect(ArcDraw.resolveTap(NET, draftFrom("p1"), ORIGIN, "p1")).toEqual({ kind: "ignore" });
  });

  it("ignores a same-kind (place → place) target", () => {
    expect(ArcDraw.resolveTap(NET, draftFrom("p1"), ORIGIN, "p2")).toEqual({ kind: "ignore" });
  });
});

describe("ArcDraw.applyTap", () => {
  beforeEach(() => {
    useNetStore.getState().setNet(NET);
    useBuildStore.getState().cancelArc();
  });

  it("creates the arc and ends the draw on connect", () => {
    useBuildStore.getState().startArc("p1", ORIGIN);
    const draft = useBuildStore.getState().draft;
    if (!draft) throw new Error("draft not started");
    ArcDraw.applyTap({ kind: "connect", target: "t1" }, draft);
    const arcs = useNetStore.getState().net.arcs;
    expect(arcs).toHaveLength(1);
    expect(arcs[0]).toMatchObject({ source: "p1", target: "t1" });
    expect(useBuildStore.getState().draft).toBeNull();
  });

  it("appends a bend and keeps the draw open", () => {
    useBuildStore.getState().startArc("p1", ORIGIN);
    const draft = useBuildStore.getState().draft;
    if (!draft) throw new Error("draft not started");
    const at: Vec2 = { x: 30, y: 40 };
    ArcDraw.applyTap({ kind: "bend", at }, draft);
    expect(useBuildStore.getState().draft?.bends).toEqual([at]);
    expect(useNetStore.getState().net.arcs).toHaveLength(0);
  });

  it("does nothing on ignore", () => {
    useBuildStore.getState().startArc("p1", ORIGIN);
    const draft = useBuildStore.getState().draft;
    if (!draft) throw new Error("draft not started");
    ArcDraw.applyTap({ kind: "ignore" }, draft);
    expect(useNetStore.getState().net.arcs).toHaveLength(0);
    expect(useBuildStore.getState().draft).not.toBeNull();
  });
});
