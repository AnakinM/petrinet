// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PnmlCodec } from "@/codec/pnml";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";

const place = (id: string, position: Vec, tokens = 0, name = id): Place => ({
  id,
  name,
  tokens,
  position,
});
const transition = (id: string, position: Vec, name = id): Transition => ({ id, name, position });
const arc = (
  id: string,
  source: string,
  target: string,
  multiplicity: number,
  points: Vec[],
): Arc => ({
  id,
  source,
  target,
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity,
  points,
});
type Vec = { x: number; y: number };

describe("PnmlCodec.serialize", () => {
  it("writes a pnml document with a PT-net page", () => {
    const net: PetriNet = {
      places: [place("P1", { x: 100, y: 100 }, 1, "Start")],
      transitions: [transition("t1", { x: 200, y: 100 })],
      arcs: [
        arc("a1", "P1", "t1", 1, [
          { x: 120, y: 100 },
          { x: 185, y: 100 },
        ]),
      ],
    };
    const xml = PnmlCodec.serialize(net);
    expect(xml).toContain("<pnml");
    expect(xml).toContain(`type="${PnmlCodec.PT_NET_TYPE}"`);
    expect(xml).toContain('<place id="P1">');
    expect(xml).toContain("<text>Start</text>");
    expect(xml).toContain('<position x="100" y="100"/>');
    expect(xml).toContain("<initialMarking><text>1</text></initialMarking>");
    expect(xml).toContain('<transition id="t1">');
    expect(xml).toContain('<arc id="a1" source="P1" target="t1">');
  });

  it("omits a zero initial marking and a unit weight", () => {
    const net: PetriNet = {
      places: [place("P1", { x: 0, y: 0 }, 0)],
      transitions: [transition("t1", { x: 50, y: 0 })],
      arcs: [
        arc("a1", "P1", "t1", 1, [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ]),
      ],
    };
    const xml = PnmlCodec.serialize(net);
    expect(xml).not.toContain("initialMarking");
    expect(xml).not.toContain("inscription");
  });

  it("writes the weight as an inscription and only interior bends as positions", () => {
    const net: PetriNet = {
      places: [place("P1", { x: 0, y: 0 })],
      transitions: [transition("t1", { x: 100, y: 0 })],
      arcs: [
        arc("a1", "P1", "t1", 3, [
          { x: 20, y: 0 },
          { x: 50, y: 30 },
          { x: 80, y: 0 },
        ]),
      ],
    };
    const xml = PnmlCodec.serialize(net);
    expect(xml).toContain("<inscription><text>3</text></inscription>");
    expect(xml).toContain('<position x="50" y="30"/>');
    // Endpoints are derived from the nodes, never written as arc positions.
    expect(xml).not.toContain('<position x="20" y="0"/>');
  });

  it("escapes XML-special characters in names", () => {
    const net: PetriNet = {
      places: [place("P1", { x: 0, y: 0 }, 0, "A & B")],
      transitions: [],
      arcs: [],
    };
    expect(PnmlCodec.serialize(net)).toContain("A &amp; B");
  });
});
