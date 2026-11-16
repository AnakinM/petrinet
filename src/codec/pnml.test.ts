// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { PnmlCodec, PnmlParseError, type PnmlRefusalReason } from "@/codec/pnml";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { SAMPLE_NET } from "@/flow/sampleNet";

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

  it("writes a moved label as the offset of the name", () => {
    const net: PetriNet = {
      places: [{ ...place("P1", { x: 0, y: 0 }, 0, "Start"), labelPosition: { x: 0, y: -30 } }],
      transitions: [transition("t1", { x: 100, y: 0 })],
      arcs: [],
    };
    const xml = PnmlCodec.serialize(net);
    expect(xml).toContain(
      '<name><text>Start</text><graphics><offset x="0" y="-30"/></graphics></name>',
    );
    // A label in its default spot has no offset.
    expect(xml).toContain("<name><text>t1</text></name>");
  });

  it("writes what the class tool's PNMLImporter reads", () => {
    const moved = { ...SAMPLE_NET.places[0], labelPosition: { x: 25, y: -30 } };
    const net: PetriNet = { ...SAMPLE_NET, places: [moved, ...SAMPLE_NET.places.slice(1)] };
    // The class tool parses "text/xml" and finds elements by tag name, ignoring namespaces.
    const doc = new DOMParser().parseFromString(PnmlCodec.serialize(net), "text/xml");
    expect(doc.getElementsByTagName("pnml")).toHaveLength(1);
    expect(doc.getElementsByTagName("net")).toHaveLength(1);
    const nodes = [...doc.getElementsByTagName("place"), ...doc.getElementsByTagName("transition")];
    expect(nodes).toHaveLength(net.places.length + net.transitions.length);
    for (const node of nodes) {
      // It reads the centre from a direct <graphics> child and the name from the first <text>.
      const graphics = [...node.children].find((c) => c.tagName === "graphics");
      expect(graphics?.getElementsByTagName("position")).toHaveLength(1);
      expect(node.getElementsByTagName("name")[0].getElementsByTagName("text")).toHaveLength(1);
    }
    // It reads a label offset from <name><graphics><offset>.
    const offset = doc.getElementsByTagName("name")[0].getElementsByTagName("offset")[0];
    expect([offset.getAttribute("x"), offset.getAttribute("y")]).toEqual(["25", "-30"]);
    // It reads the marking and the weight from <text>, and arcs by source and target id.
    const marking = doc.getElementsByTagName("initialMarking")[0];
    expect(marking.getElementsByTagName("text")[0].textContent).toBe("1");
    for (const arcEl of doc.getElementsByTagName("arc")) {
      const ids = [arcEl.getAttribute("source"), arcEl.getAttribute("target")];
      expect(ids.every((id) => nodes.some((n) => n.getAttribute("id") === id))).toBe(true);
    }
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
    // [borderPoint(t1), bend (250,140), borderPoint(P2)]: three points, the middle one the bend.
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
      places: [
        { ...place("P1", { x: 40, y: 40 }, 3, "Buf"), labelPosition: { x: -12.5, y: 30 } },
        place("P2", { x: 240, y: 40 }, 0),
      ],
      transitions: [{ ...transition("t1", { x: 140, y: 40 }), labelPosition: { x: 0, y: -30 } }],
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

/** The files in `fixtures/pnml/`, each hand-written to imitate one tool, by path. */
const FIXTURES = import.meta.glob<string>("./fixtures/pnml/*.pnml", {
  query: "?raw",
  import: "default",
  eager: true,
});
const fixture = (name: string): string => FIXTURES[`./fixtures/pnml/${name}`];

/** Each node as `[id, name, tokens or null, labelPosition]`, and each arc as `[id, source, target, weight]`. */
const summary = (net: PetriNet): { nodes: unknown[]; arcs: unknown[] } => ({
  nodes: [
    ...net.places.map((p) => [p.id, p.name, p.tokens, p.labelPosition]),
    ...net.transitions.map((t) => [t.id, t.name, null, t.labelPosition]),
  ],
  arcs: net.arcs.map((a) => [a.id, a.source, a.target, a.multiplicity]),
});

describe("PnmlCodec.parse dialects", () => {
  it("reads PIPE: <value> labels, colour-prefixed counts, no page, <arcpath> bends", () => {
    const net = PnmlCodec.parse(fixture("pipe.pnml"));
    expect(summary(net)).toEqual({
      nodes: [
        ["P0", "idle", 2, undefined], // offset (0, 0) would cover the place: default spot
        ["P1", "busy", 0, { x: -5, y: 35 }],
        ["T0", "start", null, { x: -5, y: 35 }],
      ],
      arcs: [
        ["P0 to T0", "P0", "T0", 1],
        ["T0 to P1", "T0", "P1", 3],
      ],
    });
    expect(net.places[0].position).toEqual({ x: 120, y: 90 });
    // The <arcpath> list holds both ends; only the inner point is a bend.
    expect(net.arcs[0].points).toHaveLength(2);
    expect(net.arcs[1].points[1]).toEqual({ x: 300, y: 150 });
  });

  it("reads WoPeD: no namespace, the older ptNetb type, label offsets made relative", () => {
    const net = PnmlCodec.parse(fixture("woped.pnml"));
    expect(summary(net)).toEqual({
      nodes: [
        ["p1", "start", 1, { x: 0, y: 40 }],
        ["p2", "end", 0, { x: 0, y: 40 }],
        ["t1", "work", null, { x: 0, y: -40 }],
      ],
      arcs: [
        ["a1", "p1", "t1", 1],
        ["a2", "t1", "p2", 1],
      ],
    });
    expect(net.arcs[1].points[1]).toEqual({ x: 200, y: 160 });
  });

  it("reads TAPAAL: the arc type attribute and the offset before the text", () => {
    const net = PnmlCodec.parse(fixture("tapaal.pnml"));
    expect(summary(net)).toEqual({
      nodes: [
        ["P0", "P0", 4, { x: 0, y: -30 }],
        ["P1", "P1", 0, { x: 0, y: 30 }],
        ["T0", "T0", null, { x: 0, y: 30 }],
      ],
      arcs: [
        ["A0", "P0", "T0", 2],
        ["A1", "T0", "P1", 1],
      ],
    });
    expect(net.arcs[1].points[1]).toEqual({ x: 375, y: 210 });
  });

  it("reads TINA: the tpn net type, and a firing interval is ignored", () => {
    const net = PnmlCodec.parse(fixture("tina.pnml"));
    expect(summary(net)).toEqual({
      nodes: [
        ["p-1A2B-3C50-2", "p0", 3, undefined], // a 10px offset would cover the place
        ["p-1A2B-3C52-3", "p1", 0, { x: 0, y: 40 }],
        ["t-1A2B-3C54-4", "t0", null, { x: 0, y: -35 }],
      ],
      arcs: [
        ["e-1A2B-3C56-5", "p-1A2B-3C50-2", "t-1A2B-3C54-4", 2],
        ["e-1A2B-3C58-6", "t-1A2B-3C54-4", "p-1A2B-3C52-3", 1],
      ],
    });
  });

  it("reads the class tool's one-line export", () => {
    const net = PnmlCodec.parse(fixture("class-tool.pnml"));
    expect(summary(net)).toEqual({
      nodes: [
        ["P1", "P1", 2, { x: 0, y: -30 }],
        ["P2", "P2", 0, undefined],
        ["T1", "T1", null, undefined],
      ],
      arcs: [
        ["A1", "P1", "T1", 3],
        ["A2", "T1", "P2", 1],
      ],
    });
    expect(net.arcs[1].points[1]).toEqual({ x: 325, y: 160 });
  });

  it("reads several and nested pages, and follows reference nodes to the real node", () => {
    const net = PnmlCodec.parse(fixture("standard-pages.pnml"));
    expect(net.places.map((p) => p.id)).toEqual(["ready", "buffer", "done"]);
    expect(net.transitions.map((t) => t.id)).toEqual(["produce", "consume"]);
    expect(net.arcs.map((a) => [a.id, a.source, a.target])).toEqual([
      ["a1", "ready", "produce"],
      ["a2", "produce", "buffer"],
      ["a3", "buffer", "consume"],
      ["a4", "consume", "done"],
      ["a5", "consume", "ready"], // through two references
      ["a6", "done", "produce"],
    ]);
  });
});

/** A PNML document with one page around `body`, and the net type `type` (none when null). */
const doc = (body: string, type: string | null = PnmlCodec.PT_NET_TYPE): string => {
  const typeAttr = type === null ? "" : ` type="${type}"`;
  return `<pnml xmlns="${PnmlCodec.NS}"><net id="n"${typeAttr}><page id="pg">${body}</page></net></pnml>`;
};
const P = (id: string, inner = ""): string =>
  `<place id="${id}"><graphics><position x="0" y="0"/></graphics>${inner}</place>`;
const T = (id: string): string =>
  `<transition id="${id}"><graphics><position x="100" y="0"/></graphics></transition>`;
const ARC = (inner: string, attrs = ""): string =>
  `${P("p1")}${T("t1")}<arc id="a1" source="p1" target="t1"${attrs}>${inner}</arc>`;

/** The error that `parse` throws for `xml`; fails the test when it loads. */
const refusal = (xml: string): PnmlParseError => {
  try {
    PnmlCodec.parse(xml);
  } catch (error) {
    if (error instanceof PnmlParseError) return error;
    throw error;
  }
  throw new Error("the file loaded");
};

describe("PnmlCodec.parse refusals", () => {
  it.each<[string, string, RegExp, PnmlRefusalReason]>([
    [
      "an inhibitor arc as PIPE and TINA write it",
      doc(ARC('<type value="inhibitor"/>')),
      /arc "a1" has the type "inhibitor"\. This editor supports only normal arcs\./,
      "unsupported-arc",
    ],
    [
      "an inhibitor arc as TAPAAL writes it",
      doc(ARC("", ' type="inhibitor"')),
      /arc "a1" has the type "inhibitor"/,
      "unsupported-arc",
    ],
    [
      "a read arc as TINA writes it",
      doc(ARC('<type value="test"/>')),
      /arc "a1" has the type "test"/,
      "unsupported-arc",
    ],
    [
      "a reset arc written as a label",
      doc(ARC("<type><text>reset</text></type>")),
      /arc "a1" has the type "reset"/,
      "unsupported-arc",
    ],
    [
      "a coloured net",
      doc(P("p1"), "http://www.pnml.org/version-2009/grammar/symmetricnet"),
      /net type "http:\/\/www\.pnml\.org\/version-2009\/grammar\/symmetricnet" is not a place\/transition net/,
      "net-type",
    ],
    [
      "tokens of several colours as PIPE writes them",
      doc(P("p1", "<initialMarking><value>Default,1,Red,2</value></initialMarking>")),
      /place "p1" has tokens of several colours in its initial marking \("Default,1,Red,2"\)/,
      "net-type",
    ],
    [
      "a marking that is not a number",
      doc(P("p1", "<initialMarking><text>two</text></initialMarking>")),
      /place "p1" has the initial marking "two", which is not a whole number\./,
      "invalid",
    ],
    [
      "a negative marking",
      doc(P("p1", "<initialMarking><text>-1</text></initialMarking>")),
      /place "p1" has the initial marking "-1"/,
      "invalid",
    ],
    [
      "a weight that is not a whole number",
      doc(ARC("<inscription><text>1.5</text></inscription>")),
      /arc "a1" has the weight "1\.5", which is not a whole number\./,
      "invalid",
    ],
    [
      "a weight of 0",
      doc(ARC("<inscription><text>0</text></inscription>")),
      /arc "a1" has the weight 0\. A weight must be 1 or more\./,
      "invalid",
    ],
    [
      "a place capacity as PIPE writes it",
      doc(P("p1", "<capacity><value>3</value></capacity>")),
      /place "p1" has a capacity of 3\. This editor does not support place capacities\./,
      "capacity",
    ],
    [
      "an arc between two places",
      doc(`${P("p1")}${P("p2")}<arc id="a1" source="p1" target="p2"/>`),
      /arc "a1" joins two places, "p1" and "p2"\. An arc must join a place and a transition\./,
      "invalid",
    ],
    [
      "an arc between two transitions",
      doc(`${T("t1")}${T("t2")}<arc id="a1" source="t1" target="t2"/>`),
      /arc "a1" joins two transitions, "t1" and "t2"/,
      "invalid",
    ],
    [
      "an id used twice",
      doc(`${P("x1")}${T("x1")}`),
      /the id "x1" is used by more than one element\./,
      "invalid",
    ],
    [
      "several nets",
      `<pnml><net id="n1" type="${PnmlCodec.PT_NET_TYPE}"/><net id="n2"/></pnml>`,
      /the file holds 2 nets\. This editor opens one net per file\./,
      "invalid",
    ],
    ["a file with no net", "<pnml/>", /the file has no <net> element\./, "invalid"],
    [
      "references that lead round in a circle",
      doc(
        `${T("t1")}<referencePlace id="r1" ref="r2"/><referencePlace id="r2" ref="r1"/><arc id="a1" source="r1" target="t1"/>`,
      ),
      /the reference "r1" leads round in a circle\./,
      "invalid",
    ],
    [
      "a PIPE colour other than Default",
      doc(P("p1", "<initialMarking><value>Red,2</value></initialMarking>")),
      /place "p1" has tokens of the colour "Red" in its initial marking/,
      "net-type",
    ],
    [
      "a weight in a PIPE colour other than Default",
      doc(ARC("<inscription><value>Red,1</value></inscription>")),
      /arc "a1" has tokens of the colour "Red" in its weight/,
      "net-type",
    ],
    [
      "a number with a comma in it",
      doc(P("p1", "<initialMarking><text>1,000</text></initialMarking>")),
      /place "p1" has the initial marking "1,000", which is not a whole number\./,
      "invalid",
    ],
    [
      "a number after another number",
      doc(P("p1", "<initialMarking><text>1,5</text></initialMarking>")),
      /place "p1" has the initial marking "1,5", which is not a whole number\./,
      "invalid",
    ],
    [
      "a number after an empty colour",
      doc(P("p1", "<initialMarking><text>,3</text></initialMarking>")),
      /place "p1" has the initial marking ",3", which is not a whole number\./,
      "invalid",
    ],
    [
      "a number too large to count exactly",
      doc(P("p1", "<initialMarking><text>9007199254740993</text></initialMarking>")),
      /which is not a whole number/,
      "invalid",
    ],
    [
      "two arcs from the same place to the same transition",
      doc(
        `${P("p1")}${T("t1")}<arc id="a1" source="p1" target="t1"/><arc id="a2" source="p1" target="t1"/>`,
      ),
      /arcs "a1" and "a2" both go from "p1" to "t1"\. This editor allows one arc each way between two nodes\./,
      "invalid",
    ],
    [
      "a second arc that reaches the same nodes through a reference",
      doc(
        `${P("p1")}${T("t1")}<referencePlace id="r1" ref="p1"/><arc id="a1" source="p1" target="t1"/><arc id="a2" source="r1" target="t1"/>`,
      ),
      /arcs "a1" and "a2" both go from "p1" to "t1"/,
      "invalid",
    ],
    [
      "an untyped net with a high-level marking",
      doc(P("p1", "<hlinitialMarking><text>3'dot</text></hlinitialMarking>"), null),
      /the net has no type but uses the high-level label <hlinitialMarking>/,
      "net-type",
    ],
    [
      "an untyped net with a high-level inscription",
      doc(ARC("<hlinscription><text>2'dot</text></hlinscription>"), null),
      /<hlinscription>/,
      "net-type",
    ],
    [
      "an untyped net with declarations",
      doc(`${P("p1")}<declaration><structure/></declaration>`, null),
      /<declaration>/,
      "net-type",
    ],
    [
      "a type that only ends in ptnet",
      doc(P("p1"), "http://example.org/coloured-ptnet"),
      /net type "http:\/\/example\.org\/coloured-ptnet" is not a place\/transition net/,
      "net-type",
    ],
    [
      "a reference place that points to a transition",
      doc(`${P("p1")}${T("t1")}<referencePlace id="r1" ref="t1"/>`),
      /the reference place "r1" points to the transition "t1"\. It must point to a place\./,
      "invalid",
    ],
    [
      "a reference transition that points to a place",
      doc(`${P("p1")}${T("t1")}<referenceTransition id="r1" ref="p1"/>`),
      /the reference transition "r1" points to the place "p1"\. It must point to a transition\./,
      "invalid",
    ],
    [
      "a reference to a node that is not in the file",
      doc(`${T("t1")}<referencePlace id="r1" ref="zz"/><arc id="a1" source="r1" target="t1"/>`),
      /the reference "r1" points to "zz", which is not in the file\./,
      "invalid",
    ],
    [
      "a special arc written as its own element",
      doc(`${P("p1")}${T("t1")}<inhibitorArc id="a1" source="p1" target="t1"/>`),
      /the file has an <inhibitorArc> "a1"\. This editor supports only normal arcs\./,
      "unsupported-arc",
    ],
    [
      "an arc that says normal in one place and inhibitor in another",
      doc(ARC('<type value="inhibitor"/>', ' type="normal"')),
      /arc "a1" has the type "inhibitor"/,
      "unsupported-arc",
    ],
    [
      "a TAPAAL .tapn file",
      '<pnml><net id="TAPN1" type="P/T net"><place id="P0" initialMarking="3" name="P0"/><transition id="T0" name="T0"/><arc id="A0" source="T0" target="P0" type="normal"/></net></pnml>',
      /the file is a TAPAAL net \(\.tapn\), not PNML\. In TAPAAL, export the net as PNML and open that file\./,
      "invalid",
    ],
    [
      "a TAPAAL .tapn file with timed and transport arcs",
      '<pnml><net id="TAPN1" type="P/T net"><place id="P0" initialMarking="1"/><transition id="T0"/><arc id="A0" source="P0" target="T0" type="timed" inscription="[0,inf)"/><arc id="A1" source="P0" target="T0" type="transport"/></net></pnml>',
      /the file is a TAPAAL net \(\.tapn\)/,
      "net-type",
    ],
  ])("refuses %s", (_, xml, message, reason) => {
    const error = refusal(xml);
    expect(error.message).toMatch(message);
    expect(error.reason).toBe(reason);
  });

  it.each([
    ["no net type", null],
    ["the 2009 ptnet type", PnmlCodec.PT_NET_TYPE],
    ["the older ptNetb type of WoPeD", "http://www.informatik.hu-berlin.de/top/pntd/ptNetb"],
    ["the older ptNetb type of PNML 1", "http://www.informatik.hu-berlin.de/top/pnml/ptNetb"],
    ["PIPE's type", "P/T net"],
    ["TINA's tpn type", "http://www.laas.fr/tina/tpn"],
  ])("accepts %s", (_, type) => {
    expect(PnmlCodec.parse(doc(P("p1"), type)).places).toHaveLength(1);
  });

  it("accepts the Default colour in any case", () => {
    const net = PnmlCodec.parse(
      doc(P("p1", "<initialMarking><value>default,4</value></initialMarking>")),
    );
    expect(net.places[0].tokens).toBe(4);
  });

  it("accepts one arc each way between a place and a transition", () => {
    const xml = doc(
      `${P("p1")}${T("t1")}<arc id="a1" source="p1" target="t1"/><arc id="a2" source="t1" target="p1"/>`,
    );
    expect(PnmlCodec.parse(xml).arcs).toHaveLength(2);
  });

  it("accepts a capacity of 0, which PIPE writes for no limit", () => {
    const net = PnmlCodec.parse(doc(P("p1", "<capacity><value>0</value></capacity>")));
    expect(net.places).toHaveLength(1);
  });
});

describe("PnmlCodec.parse layout and labels", () => {
  it("lays the nodes out on a grid when no node has a position", () => {
    const xml = doc(
      '<place id="p1"/><place id="p2"/><place id="p3"/><transition id="t1"/><transition id="t2"/><arc id="a1" source="p1" target="t1"/>',
    );
    const net = PnmlCodec.parse(xml);
    const step = PnmlCodec.LAYOUT_STEP;
    expect([...net.places, ...net.transitions].map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: step, y: 0 },
      { x: 2 * step, y: 0 },
      { x: 0, y: step },
      { x: step, y: step },
    ]);
  });

  it("reads a name offset into labelPosition and ignores one that covers the node", () => {
    const named = (x: number, y: number): string =>
      `<name><text>p</text><graphics><offset x="${x}" y="${y}"/></graphics></name>`;
    const net = PnmlCodec.parse(doc(`${P("p1", named(12, -30))}${P("p2", named(5, 5))}`));
    expect(net.places.map((p) => p.labelPosition)).toEqual([{ x: 12, y: -30 }, undefined]);
  });

  it("never reads nodes inside a tool-specific block", () => {
    const xml = doc(`${P("p1")}<toolspecific tool="X"><place id="hidden"/></toolspecific>`);
    expect(PnmlCodec.parse(xml).places.map((p) => p.id)).toEqual(["p1"]);
  });
});
