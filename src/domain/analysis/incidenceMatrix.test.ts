import { describe, expect, it } from "vitest";
import { IncidenceMatrix } from "@/domain/analysis/incidenceMatrix";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string, tokens = 0): Place => ({
  id,
  name: id,
  tokens,
  position: { x: 0, y: 0 },
});
const transition = (id: string): Transition => ({ id, name: id, position: { x: 0, y: 0 } });
const arc = (source: string, target: string, multiplicity = 1): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity,
  points: [],
});

describe("IncidenceMatrix", () => {
  it("places Pre/Post by arc direction and derives C = Post − Pre", () => {
    // p1 --2--> t1 --3--> p2
    const net: PetriNet = {
      places: [place("p1"), place("p2")],
      transitions: [transition("t1")],
      arcs: [arc("p1", "t1", 2), arc("t1", "p2", 3)],
    };
    const m = new IncidenceMatrix(net);
    expect(m.pre).toEqual([[2], [0]]);
    expect(m.post).toEqual([[0], [3]]);
    expect(m.c).toEqual([[-2], [3]]);
  });

  it("indexes rows by net.places order and columns by net.transitions order", () => {
    const net: PetriNet = {
      places: [place("pa"), place("pb")],
      transitions: [transition("tx"), transition("ty")],
      arcs: [arc("pa", "tx"), arc("ty", "pb")],
    };
    const m = new IncidenceMatrix(net);
    expect(m.places).toEqual(["pa", "pb"]);
    expect(m.transitions).toEqual(["tx", "ty"]);
    // pa→tx is Pre[0][0]; ty→pb is Post[1][1].
    expect(m.c).toEqual([
      [-1, 0],
      [0, 1],
    ]);
  });

  it("sums parallel arcs on the same (place, transition) pair", () => {
    const net: PetriNet = {
      places: [place("p1")],
      transitions: [transition("t1")],
      arcs: [arc("p1", "t1", 1), { ...arc("p1", "t1", 2), id: "second" }],
    };
    expect(new IncidenceMatrix(net).pre).toEqual([[3]]);
  });

  it("ignores arcs whose endpoint is not in the net", () => {
    const net: PetriNet = {
      places: [place("p1")],
      transitions: [transition("t1")],
      arcs: [arc("p1", "t1"), arc("ghost", "t1"), arc("t1", "ghost")],
    };
    const m = new IncidenceMatrix(net);
    expect(m.pre).toEqual([[1]]);
    expect(m.post).toEqual([[0]]);
  });

  it("yields empty matrices for the empty net", () => {
    const m = new IncidenceMatrix({ places: [], transitions: [], arcs: [] });
    expect(m.places).toEqual([]);
    expect(m.transitions).toEqual([]);
    expect(m.c).toEqual([]);
  });
});
