import { describe, expect, it } from "vitest";
import type { Arc, PetriNet, Place, Transition } from "@/domain/types";
import { NetSvg } from "@/flow/svgExport";

const place = (id: string, position: { x: number; y: number }, tokens = 0, name = id): Place => ({
  id,
  name,
  tokens,
  position,
});
const transition = (
  id: string,
  position: { x: number; y: number },
  rotation?: number,
): Transition => ({
  id,
  name: id,
  position,
  ...(rotation === undefined ? {} : { gui: { rotation } }),
});
const arc = (multiplicity: number, points: { x: number; y: number }[]): Arc => ({
  id: "a",
  source: "s",
  target: "t",
  srcMagnetic: true,
  destMagnetic: true,
  multiplicity,
  points,
});

describe("NetSvg", () => {
  it("renders an empty net as a blank white document", () => {
    const svg = NetSvg.serialize({ places: [], transitions: [], arcs: [] });
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('width="100"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("draws a place as a circle with its name label", () => {
    const net: PetriNet = {
      places: [place("P1", { x: 100, y: 100 }, 0, "Start")],
      transitions: [],
      arcs: [],
    };
    const svg = NetSvg.serialize(net);
    expect(svg).toContain('<circle cx="100" cy="100" r="20"');
    expect(svg).toContain(">Start</text>");
  });

  it("renders 1–4 tokens as dots and 5+ as a numeral", () => {
    const dots = NetSvg.serialize({
      places: [place("P", { x: 0, y: 0 }, 3)],
      transitions: [],
      arcs: [],
    });
    expect((dots.match(/<circle[^>]*r="3.5"/g) ?? []).length).toBe(3);

    const numeral = NetSvg.serialize({
      places: [place("P", { x: 0, y: 0 }, 7)],
      transitions: [],
      arcs: [],
    });
    expect(numeral).toContain(">7</text>");
    expect(numeral).not.toContain('r="3.5"');
  });

  it("draws a transition bar, rotating it only when gui.rotation is set", () => {
    const upright = NetSvg.serialize({
      places: [],
      transitions: [transition("t", { x: 50, y: 50 })],
      arcs: [],
    });
    expect(upright).toContain('width="15" height="40"');
    expect(upright).not.toContain("transform=");

    const rotated = NetSvg.serialize({
      places: [],
      transitions: [transition("t", { x: 50, y: 50 }, 90)],
      arcs: [],
    });
    expect(rotated).toContain('transform="rotate(90 50 50)"');
  });

  it("draws an arc as an arrowed path and shows a weight greater than one", () => {
    const net: PetriNet = {
      places: [],
      transitions: [],
      arcs: [
        arc(2, [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ]),
      ],
    };
    const svg = NetSvg.serialize(net);
    expect(svg).toContain('marker-end="url(#arc-arrow)"');
    expect(svg).toContain('<path d="M 0 0 L 40 0"');
    // Weight chip at the polyline midpoint.
    expect(svg).toContain(">2</text>");
  });

  it("omits the weight chip when multiplicity is one", () => {
    const net: PetriNet = {
      places: [],
      transitions: [],
      arcs: [
        arc(1, [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ]),
      ],
    };
    expect(NetSvg.serialize(net)).not.toContain(">1</text>");
  });

  it("escapes XML-special characters in names", () => {
    const net: PetriNet = {
      places: [place("P", { x: 0, y: 0 }, 0, "A & B <x>")],
      transitions: [],
      arcs: [],
    };
    const svg = NetSvg.serialize(net);
    expect(svg).toContain("A &amp; B &lt;x&gt;");
    expect(svg).not.toContain("A & B <x>");
  });

  it("frames the net with padding around its bounding box", () => {
    // A nameless place at (100,100) spans 80..120; with PADDING 24 the viewBox starts at 56.
    const net: PetriNet = {
      places: [place("P", { x: 100, y: 100 }, 0, "")],
      transitions: [],
      arcs: [],
    };
    expect(NetSvg.serialize(net)).toContain('viewBox="56 56 88 88"');
  });
});
