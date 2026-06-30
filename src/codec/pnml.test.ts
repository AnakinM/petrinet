// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PnmlCodec, PnmlParseError } from "@/codec/pnml";
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

const PNML = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <page id="page1">
      <place id="P1"><name><text>Start</text></name><graphics><position x="100" y="100"/></graphics><initialMarking><text>2</text></initialMarking></place>
      <place id="P2"><name><text>End</text></name><graphics><position x="300" y="100"/></graphics></place>
      <transition id="t1"><name><text>fire</text></name><graphics><position x="200" y="100"/></graphics></transition>
      <arc id="a1" source="P1" target="t1"><inscription><text>2</text></inscription></arc>
      <arc id="a2" source="t1" target="P2"><graphics><position x="250" y="140"/></graphics></arc>
    </page>
  </net>
</pnml>`;

describe("PnmlCodec.parse", () => {
  it("reads places, transitions and arcs with names, markings and weights", () => {
    const net = PnmlCodec.parse(PNML);
    expect(net.places.map((p) => [p.id, p.name, p.tokens])).toEqual([
      ["P1", "Start", 2],
      ["P2", "End", 0], // initialMarking absent → 0
    ]);
    expect(net.transitions.map((t) => [t.id, t.name])).toEqual([["t1", "fire"]]);
    expect(net.places[0].position).toEqual({ x: 100, y: 100 });
    expect(net.arcs.map((a) => [a.id, a.source, a.target, a.multiplicity])).toEqual([
      ["a1", "P1", "t1", 2],
      ["a2", "t1", "P2", 1], // inscription absent → weight 1
    ]);
  });

  it("re-derives arc endpoints on the node borders and keeps interior bends", () => {
    const net = PnmlCodec.parse(PNML);
    const a2 = net.arcs.find((a) => a.id === "a2");
    if (a2 === undefined) throw new Error("a2 missing");
    // [borderPoint(t1), bend (250,140), borderPoint(P2)] — three points, the middle one the bend.
    expect(a2.points).toHaveLength(3);
    expect(a2.points[1]).toEqual({ x: 250, y: 140 });
  });

  it("throws a clear error on malformed XML", () => {
    expect(() => PnmlCodec.parse("<pnml><net>")).toThrow(PnmlParseError);
  });

  it("throws when the root is not pnml", () => {
    expect(() => PnmlCodec.parse('<?xml version="1.0"?><foo/>')).toThrow(/pnml/);
  });

  it("throws when an arc references an unknown node", () => {
    const bad = `<pnml xmlns="${PnmlCodec.NS}"><net id="n" type="${PnmlCodec.PT_NET_TYPE}"><page id="p">
      <place id="P1"><graphics><position x="0" y="0"/></graphics></place>
      <arc id="a1" source="P1" target="ghost"/>
    </page></net></pnml>`;
    expect(() => PnmlCodec.parse(bad)).toThrow(/unknown node/);
  });

  it("round-trips a net's structure through serialize → parse", () => {
    const original: PetriNet = {
      places: [place("P1", { x: 40, y: 40 }, 3, "Buf"), place("P2", { x: 240, y: 40 }, 0)],
      transitions: [transition("t1", { x: 140, y: 40 })],
      arcs: [
        arc("a1", "P1", "t1", 2, [
          { x: 60, y: 40 },
          { x: 100, y: 80 },
          { x: 132, y: 40 },
        ]),
      ],
    };
    const back = PnmlCodec.parse(PnmlCodec.serialize(original));
    expect(back.places).toEqual(original.places);
    expect(back.transitions).toEqual(original.transitions);
    // Arc identity, endpoints and weight survive; the interior bend is preserved verbatim.
    const a = back.arcs[0];
    expect([a.id, a.source, a.target, a.multiplicity]).toEqual(["a1", "P1", "t1", 2]);
    expect(a.points[1]).toEqual({ x: 100, y: 80 });
  });
});
