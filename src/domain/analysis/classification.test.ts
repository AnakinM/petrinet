import { describe, expect, it } from "vitest";
import { NetClassification } from "@/domain/analysis/classification";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string): Place => ({ id, name: id, tokens: 0, position: { x: 0, y: 0 } });
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

// P1 ⇄ P2 via t1, t2: a simple cycle, both a state machine and a marked graph, and free choice.
const cycle = (): PetriNet => ({
  places: [place("P1"), place("P2")],
  transitions: [transition("t1"), transition("t2")],
  arcs: [arc("P1", "t1"), arc("t1", "P2"), arc("P2", "t2"), arc("t2", "P1")],
});

describe("NetClassification", () => {
  describe("ordinary", () => {
    it("holds when every arc has weight 1", () => {
      expect(NetClassification.classify(cycle()).ordinary.verdict).toBe("yes");
    });

    it("fails on a weighted arc and flags both endpoints", () => {
      const net = cycle();
      net.arcs[0] = arc("P1", "t1", 2);
      const result = NetClassification.classify(net).ordinary;
      expect(result.verdict).toBe("no");
      expect(result.erroneous).toEqual(expect.arrayContaining(["P1", "t1"]));
      expect(result.erroneousArcs).toEqual(["P1->t1"]);
      expect(result.reasons).toEqual(["1 arc has a weight above 1."]);
    });

    it("uses the plural for several heavy arcs", () => {
      const net = cycle();
      net.arcs[0] = arc("P1", "t1", 2);
      net.arcs[1] = arc("t1", "P2", 3);
      expect(NetClassification.classify(net).ordinary.reasons).toEqual([
        "2 arcs have a weight above 1.",
      ]);
    });
  });

  describe("textbook rule: classes require an ordinary net", () => {
    it("names both the shape and the heavy arc for a state machine", () => {
      const net = cycle();
      net.arcs[0] = arc("P1", "t1", 2);
      const c = NetClassification.classify(net);
      expect(c.stateMachine.verdict).toBe("no");
      expect(c.stateMachine.reasons).toEqual([
        "The shape fits a state machine, but 1 arc has a weight above 1.",
      ]);
      expect(c.stateMachine.erroneousArcs).toEqual(["P1->t1"]);
      expect(c.stateMachine.erroneous).toEqual([]);
      expect(c.markedGraph.reasons).toEqual([
        "The shape fits a marked graph, but 1 arc has a weight above 1.",
      ]);
      expect(c.freeChoice.reasons).toEqual([
        "The shape fits a free-choice net, but 1 arc has a weight above 1.",
      ]);
    });

    it("uses the plural and lists every heavy arc", () => {
      const net = cycle();
      net.arcs[0] = arc("P1", "t1", 2);
      net.arcs[2] = arc("P2", "t2", 5);
      const c = NetClassification.classify(net);
      expect(c.stateMachine.reasons[0]).toBe(
        "The shape fits a state machine, but 2 arcs have a weight above 1.",
      );
      expect(c.stateMachine.erroneousArcs).toEqual(["P1->t1", "P2->t2"]);
    });

    it("keeps the shape reason and adds the weight reason when both fail", () => {
      const net: PetriNet = {
        places: [place("P1"), place("P2"), place("P3")],
        transitions: [transition("t1")],
        arcs: [arc("P1", "t1", 2), arc("P2", "t1"), arc("t1", "P3")],
      };
      const result = NetClassification.classify(net).stateMachine;
      expect(result.verdict).toBe("no");
      expect(result.reasons).toHaveLength(2);
      expect(result.reasons[1]).toBe("1 arc has a weight above 1.");
      expect(result.erroneous).toEqual(["t1"]);
      expect(result.erroneousArcs).toEqual(["P1->t1"]);
    });

    it("leaves erroneousArcs empty on an ordinary net", () => {
      const c = NetClassification.classify(cycle());
      expect([c.ordinary, c.stateMachine, c.markedGraph, c.freeChoice]).toSatisfy(
        (rs: { erroneousArcs: string[] }[]) => rs.every((r) => r.erroneousArcs.length === 0),
      );
    });
  });

  describe("state machine", () => {
    it("holds when every transition has one input and one output place", () => {
      expect(NetClassification.classify(cycle()).stateMachine.verdict).toBe("yes");
    });

    it("fails and flags a transition with two input places (a join)", () => {
      const net: PetriNet = {
        places: [place("P1"), place("P2"), place("P3")],
        transitions: [transition("t1")],
        arcs: [arc("P1", "t1"), arc("P2", "t1"), arc("t1", "P3")],
      };
      const result = NetClassification.classify(net).stateMachine;
      expect(result.verdict).toBe("no");
      expect(result.erroneous).toContain("t1");
    });
  });

  describe("marked graph", () => {
    it("holds for the simple cycle", () => {
      expect(NetClassification.classify(cycle()).markedGraph.verdict).toBe("yes");
    });

    it("fails and flags a place with two output transitions (a choice)", () => {
      const net: PetriNet = {
        places: [place("P1")],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("P1", "t1"), arc("P1", "t2")],
      };
      const result = NetClassification.classify(net).markedGraph;
      expect(result.verdict).toBe("no");
      expect(result.erroneous).toContain("P1");
    });
  });

  describe("free choice", () => {
    it("allows a place to feed several transitions when none of them has other inputs", () => {
      const net: PetriNet = {
        places: [place("P1")],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("P1", "t1"), arc("P1", "t2")],
      };
      expect(NetClassification.classify(net).freeChoice.verdict).toBe("yes");
    });

    it("fails when a shared place forces a conflict, flagging the place and transition", () => {
      // P1 feeds t1 and t2 (two outputs); t1 also needs P2 (a second input),
      // so it is a non-free choice.
      const net: PetriNet = {
        places: [place("P1"), place("P2")],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("P1", "t1"), arc("P1", "t2"), arc("P2", "t1")],
      };
      const result = NetClassification.classify(net).freeChoice;
      expect(result.verdict).toBe("no");
      expect(result.erroneous).toEqual(expect.arrayContaining(["P1", "t1"]));
    });
  });

  it("treats an empty net's classes as vacuously holding", () => {
    const c = NetClassification.classify({ places: [], transitions: [], arcs: [] });
    expect(c.ordinary.verdict).toBe("yes");
    expect(c.stateMachine.verdict).toBe("yes");
    expect(c.markedGraph.verdict).toBe("yes");
    expect(c.freeChoice.verdict).toBe("yes");
  });

  describe("verbs agree with the count", () => {
    it("uses singular verbs for one transition, one place and one arc", () => {
      const join: PetriNet = {
        places: [place("P1"), place("P2"), place("P3")],
        transitions: [transition("t1")],
        arcs: [arc("P1", "t1"), arc("P2", "t1"), arc("t1", "P3")],
      };
      const c = NetClassification.classify(join);
      expect(c.stateMachine.reasons[0]).toBe(
        "1 transition lacks exactly one input and one output place.",
      );
      expect(c.markedGraph.reasons[0]).toContain("3 places lack exactly");
      const choice: PetriNet = {
        places: [place("P1"), place("P2")],
        transitions: [transition("t1"), transition("t2")],
        arcs: [arc("P1", "t1"), arc("P1", "t2"), arc("P2", "t1")],
      };
      expect(NetClassification.classify(choice).freeChoice.reasons[0]).toMatch(
        /^1 arc breaks free choice/,
      );
      const single: PetriNet = {
        places: [place("P1"), place("P2")],
        transitions: [],
        arcs: [],
      };
      expect(NetClassification.classify(single).markedGraph.reasons[0]).toMatch(/^2 places lack/);
      const one: PetriNet = { places: [place("P1")], transitions: [], arcs: [] };
      expect(NetClassification.classify(one).markedGraph.reasons[0]).toMatch(/^1 place lacks/);
    });
  });
});
