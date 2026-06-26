import { describe, expect, it } from "vitest";
import { NetNames } from "@/domain/netNames";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string, name: string): Place => ({
  id,
  name,
  tokens: 0,
  position: { x: 0, y: 0 },
});
const transition = (id: string, name: string): Transition => ({
  id,
  name,
  position: { x: 0, y: 0 },
});
const arc = (source: string, target: string): Arc => ({
  id: `${source}->${target}`,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity: 1,
  points: [],
});

describe("NetNames", () => {
  describe("describeFiring", () => {
    it("formats a single input and output as `T: P → P`", () => {
      const net: PetriNet = {
        places: [place("p1", "P1"), place("p2", "P2")],
        transitions: [transition("t1", "T1")],
        arcs: [arc("p1", "t1"), arc("t1", "p2")],
      };
      expect(NetNames.describeFiring(net, "t1")).toBe("T1: P1 → P2");
    });

    it("joins multiple places on each side with ` + `, in arc order", () => {
      const net: PetriNet = {
        places: [place("p1", "P1"), place("p2", "P2"), place("p3", "P3"), place("p4", "P4")],
        transitions: [transition("t1", "T1")],
        arcs: [arc("p1", "t1"), arc("p2", "t1"), arc("t1", "p3"), arc("t1", "p4")],
      };
      expect(NetNames.describeFiring(net, "t1")).toBe("T1: P1 + P2 → P3 + P4");
    });

    it("shows ∅ for a source transition (no input places)", () => {
      const net: PetriNet = {
        places: [place("p1", "P1")],
        transitions: [transition("t1", "T1")],
        arcs: [arc("t1", "p1")],
      };
      expect(NetNames.describeFiring(net, "t1")).toBe("T1: ∅ → P1");
    });

    it("shows ∅ for a sink transition (no output places)", () => {
      const net: PetriNet = {
        places: [place("p1", "P1")],
        transitions: [transition("t1", "T1")],
        arcs: [arc("p1", "t1")],
      };
      expect(NetNames.describeFiring(net, "t1")).toBe("T1: P1 → ∅");
    });
  });
});
