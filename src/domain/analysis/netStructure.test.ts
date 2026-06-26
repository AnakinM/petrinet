import { describe, expect, it } from "vitest";
import { NetStructure } from "@/domain/analysis/netStructure";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string): Place => ({ id, name: id, tokens: 0, position: { x: 0, y: 0 } });
const transition = (id: string): Transition => ({ id, name: id, position: { x: 0, y: 0 } });
const arc = (source: string, target: string): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity: 1,
  points: [],
});

describe("NetStructure.analyze", () => {
  describe("a cyclic net (one token loops p1 -> t1 -> p2 -> t2 -> p1)", () => {
    const net: PetriNet = {
      places: [place("p1"), place("p2")],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("p1", "t1"), arc("t1", "p2"), arc("p2", "t2"), arc("t2", "p1")],
    };
    const r = NetStructure.analyze(net);

    it("reports the whole net as one cyclic component, in net order", () => {
      expect(r.cyclicComponents).toEqual([["p1", "p2", "t1", "t2"]]);
      expect(r.acyclic).toBe(false);
    });

    it("has no sources, sinks or isolated nodes and is connected", () => {
      expect(r.sourcePlaces).toEqual([]);
      expect(r.sinkPlaces).toEqual([]);
      expect(r.sourceTransitions).toEqual([]);
      expect(r.sinkTransitions).toEqual([]);
      expect(r.isolated).toEqual([]);
      expect(r.connected).toBe(true);
    });
  });

  describe("an acyclic line (p1 -> t1 -> p2 -> t2 -> p3)", () => {
    const net: PetriNet = {
      places: [place("p1"), place("p2"), place("p3")],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("p1", "t1"), arc("t1", "p2"), arc("p2", "t2"), arc("t2", "p3")],
    };
    const r = NetStructure.analyze(net);

    it("finds no loops", () => {
      expect(r.cyclicComponents).toEqual([]);
      expect(r.acyclic).toBe(true);
    });

    it("names the source and sink places, with no source/sink transitions", () => {
      expect(r.sourcePlaces).toEqual(["p1"]);
      expect(r.sinkPlaces).toEqual(["p3"]);
      expect(r.sourceTransitions).toEqual([]);
      expect(r.sinkTransitions).toEqual([]);
      expect(r.connected).toBe(true);
    });
  });

  describe("source/sink transitions and isolated nodes", () => {
    // t_in produces into p1 (a source transition); t_out drains p2 (a sink transition); p9 floats.
    const net: PetriNet = {
      places: [place("p1"), place("p2"), place("p9")],
      transitions: [transition("t_in"), transition("t_out")],
      arcs: [arc("t_in", "p1"), arc("p1", "t_out"), arc("t_out", "p2")],
    };
    const r = NetStructure.analyze(net);

    it("classifies source/sink by kind", () => {
      expect(r.sourceTransitions).toEqual(["t_in"]);
      expect(r.sinkPlaces).toEqual(["p2"]);
      expect(r.sourcePlaces).toEqual([]); // p1 has an incoming arc
      expect(r.sinkTransitions).toEqual([]); // t_out has an outgoing arc
    });

    it("reports an arc-less node only as isolated, never as a source or sink", () => {
      expect(r.isolated).toEqual(["p9"]);
      expect(r.sourcePlaces).not.toContain("p9");
      expect(r.sinkPlaces).not.toContain("p9");
    });

    it("is not connected — the isolated node is its own weak component", () => {
      expect(r.connected).toBe(false);
    });
  });

  describe("two disconnected components", () => {
    const net: PetriNet = {
      places: [place("p1"), place("p2")],
      transitions: [transition("t1"), transition("t2")],
      arcs: [arc("p1", "t1"), arc("p2", "t2")],
    };
    it("is not weakly connected", () => {
      expect(NetStructure.analyze(net).connected).toBe(false);
    });
  });

  describe("boundary cases", () => {
    it("treats the empty net as vacuously connected with nothing to report", () => {
      const r = NetStructure.analyze({ places: [], transitions: [], arcs: [] });
      expect(r.connected).toBe(true);
      expect(r.acyclic).toBe(true);
      expect(r.cyclicComponents).toEqual([]);
      expect(r.isolated).toEqual([]);
    });

    it("ignores a dangling arc whose endpoint is not a node of the net", () => {
      const net: PetriNet = {
        places: [place("p1")],
        transitions: [transition("t1")],
        arcs: [arc("p1", "t1"), arc("t1", "ghost")],
      };
      const r = NetStructure.analyze(net);
      // The ghost arc adds no edge, so t1 keeps no outgoing arc and stays a sink.
      expect(r.sinkTransitions).toEqual(["t1"]);
      expect(r.sourcePlaces).toEqual(["p1"]);
      expect(r.connected).toBe(true);
      expect(r.isolated).toEqual([]);
    });
  });
});
