import { describe, expect, it } from "vitest";
import { NetOps } from "@/domain/netOps";
import type { PetriNet } from "@/domain/types";

/** A tiny net: place `p` (center 0,0) → transition `t` (center 100,0), magnetic both ends. */
function net(): PetriNet {
  return {
    places: [{ id: "p", name: "p", tokens: 2, position: { x: 0, y: 0 } }],
    transitions: [{ id: "t", name: "t", position: { x: 100, y: 0 } }],
    arcs: [
      {
        id: "a",
        source: "p",
        target: "t",
        srcMagnetic: true,
        destMagnetic: true,
        multiplicity: 1,
        points: [
          { x: 20, y: 0 }, // p border, toward t
          { x: 92.5, y: 0 }, // t border, toward p
        ],
      },
    ],
  };
}

describe("NetOps.addPlace / addTransition", () => {
  it("appends a place with 0 tokens at the position", () => {
    const after = NetOps.addPlace(net(), { x: 5, y: 6 });
    expect(after.places).toHaveLength(2);
    const added = after.places[1];
    expect(added).toMatchObject({ tokens: 0, position: { x: 5, y: 6 } });
    expect(added.id).not.toBe("p");
  });

  it("appends an unrotated transition", () => {
    const after = NetOps.addTransition(net(), { x: 5, y: 6 });
    expect(after.transitions).toHaveLength(2);
    expect(after.transitions[1].gui).toBeUndefined();
  });

  it("does not mutate the input net", () => {
    const before = net();
    NetOps.addPlace(before, { x: 1, y: 1 });
    expect(before.places).toHaveLength(1);
  });
});

describe("NetOps.moveNode", () => {
  it("translates magnetic endpoints by the node delta, leaving waypoints and free ends", () => {
    const start = net();
    // Add an interior waypoint and make the target endpoint free.
    start.arcs[0].points = [
      { x: 20, y: 0 },
      { x: 50, y: 30 }, // waypoint — must not move
      { x: 92.5, y: 0 },
    ];
    start.arcs[0].destMagnetic = false; // target endpoint is free — must not move
    const after = NetOps.moveNode(start, "p", { x: 10, y: 5 });

    expect(after.places[0].position).toEqual({ x: 10, y: 5 });
    expect(after.arcs[0].points[0]).toEqual({ x: 30, y: 5 }); // src magnetic moved by (10,5)
    expect(after.arcs[0].points[1]).toEqual({ x: 50, y: 30 }); // waypoint unchanged
    expect(after.arcs[0].points[2]).toEqual({ x: 92.5, y: 0 }); // free target unchanged
  });

  it("is a no-op (same reference net contents) when the node does not move", () => {
    const before = net();
    const after = NetOps.moveNode(before, "p", { x: 0, y: 0 });
    expect(after).toBe(before);
  });

  it("ignores an unknown id", () => {
    const before = net();
    expect(NetOps.moveNode(before, "nope", { x: 9, y: 9 })).toBe(before);
  });
});

describe("NetOps.canConnect", () => {
  it("accepts a bipartite pair in either direction", () => {
    expect(NetOps.canConnect(net(), "t", "p")).toBe(true);
  });

  it("rejects same-kind, self, and duplicate same-direction arcs", () => {
    const n = net();
    expect(NetOps.canConnect(n, "p", "p")).toBe(false); // self
    const twoPlaces: PetriNet = { ...n, places: [...n.places, { ...n.places[0], id: "p2" }] };
    expect(NetOps.canConnect(twoPlaces, "p", "p2")).toBe(false); // place→place
    expect(NetOps.canConnect(n, "p", "t")).toBe(false); // duplicate of existing a
  });
});

describe("NetOps.connect", () => {
  it("creates a magnetic, weight-1 arc with endpoints clipped to the borders", () => {
    const after = NetOps.connect(net(), "t", "p");
    expect(after.arcs).toHaveLength(2);
    const arc = after.arcs[1];
    expect(arc).toMatchObject({
      source: "t",
      target: "p",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
    });
    // t (100,0) toward p (0,0): exits the 15×40 bar on its short side at x=92.5.
    expect(arc.points[0]).toEqual({ x: 92.5, y: 0 });
    // p (0,0) toward t: circle radius 20 → x=20.
    expect(arc.points[1]).toEqual({ x: 20, y: 0 });
  });

  it("no-ops an invalid connection", () => {
    const before = net();
    expect(NetOps.connect(before, "p", "t")).toBe(before); // duplicate
  });
});

describe("NetOps.rename / setTokens / setMultiplicity", () => {
  it("renames a node", () => {
    expect(NetOps.rename(net(), "t", "fire").transitions[0].name).toBe("fire");
  });

  it("clamps tokens to a non-negative integer", () => {
    expect(NetOps.setTokens(net(), "p", -3).places[0].tokens).toBe(0);
    expect(NetOps.setTokens(net(), "p", 4.7).places[0].tokens).toBe(5);
  });

  it("clamps multiplicity to an integer ≥ 1", () => {
    expect(NetOps.setMultiplicity(net(), "a", 0).arcs[0].multiplicity).toBe(1);
    expect(NetOps.setMultiplicity(net(), "a", 3).arcs[0].multiplicity).toBe(3);
  });
});

describe("NetOps.toggleEndpointMagnetic", () => {
  it("turning an endpoint free keeps its current point", () => {
    const after = NetOps.toggleEndpointMagnetic(net(), "a", "src");
    expect(after.arcs[0].srcMagnetic).toBe(false);
    expect(after.arcs[0].points[0]).toEqual({ x: 20, y: 0 }); // unchanged
  });

  it("turning an endpoint magnetic re-clips it to the border", () => {
    const start = net();
    start.arcs[0].srcMagnetic = false;
    start.arcs[0].points[0] = { x: -50, y: 0 }; // detached, off the border
    const after = NetOps.toggleEndpointMagnetic(start, "a", "src");
    expect(after.arcs[0].srcMagnetic).toBe(true);
    expect(after.arcs[0].points[0]).toEqual({ x: 20, y: 0 }); // re-clipped to circle border
  });
});

describe("NetOps.remove", () => {
  it("removes a node together with its incident arcs", () => {
    const after = NetOps.remove(net(), "p");
    expect(after.places).toHaveLength(0);
    expect(after.arcs).toHaveLength(0); // arc a was incident
    expect(after.transitions).toHaveLength(1);
  });

  it("removes an arc without touching its nodes", () => {
    const after = NetOps.remove(net(), "a");
    expect(after.arcs).toHaveLength(0);
    expect(after.places).toHaveLength(1);
    expect(after.transitions).toHaveLength(1);
  });

  it("ignores an unknown id", () => {
    const before = net();
    const after = NetOps.remove(before, "nope");
    expect(after.places).toHaveLength(1);
    expect(after.arcs).toHaveLength(1);
  });
});
