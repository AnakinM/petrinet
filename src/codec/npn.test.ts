import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NpnCodec, NpnParseError } from "@/codec/npn";
import type { PetriNet } from "@/domain/types";

// Made-up nets drawn and exported in the course tool, committed exactly as the browser
// downloaded them. Never re-save them through an editor: these tests compare raw bytes.
const FIXTURE = new URL("./fixtures/npn/class-tool-sample.npn", import.meta.url);
// The same net with one arc label moved in the session that drew the arc, so the course tool
// wrote that arc's labelPosition before its points.
const ARC_LABEL_FIRST = new URL("./fixtures/npn/class-tool-arc-label-first.npn", import.meta.url);
const sampleBytes = (file: URL): Uint8Array => new Uint8Array(readFileSync(file));
const fixtureBytes = (): Uint8Array => sampleBytes(FIXTURE);
const fixtureText = (): string => new TextDecoder().decode(fixtureBytes());

/** Offset of the first byte where an import and export of `file` differs from it, or -1. */
function roundTripDiff(file: URL): number {
  const raw = sampleBytes(file);
  const out = new TextEncoder().encode(
    NpnCodec.BOM + NpnCodec.serialize(NpnCodec.parse(new TextDecoder().decode(raw))),
  );
  const limit = Math.min(raw.length, out.length);
  for (let i = 0; i < limit; i++) {
    if (raw[i] !== out[i]) return i;
  }
  return raw.length === out.length ? -1 : limit;
}

describe("NpnCodec", () => {
  describe("round-trip fidelity (course tool sample)", () => {
    it("re-serializes the course tool sample byte-identically", () => {
      expect(roundTripDiff(FIXTURE)).toBe(-1);
    });

    it("re-serializes the course tool sample with an arc label written first byte-identically", () => {
      expect(roundTripDiff(ARC_LABEL_FIRST)).toBe(-1);
    });

    it("parses the expected element counts", () => {
      const net = NpnCodec.parse(fixtureText());
      expect(net.places).toHaveLength(4);
      expect(net.transitions).toHaveLength(2);
      expect(net.arcs).toHaveLength(7);
    });
  });

  describe("byte format (course tool sample)", () => {
    it("fixture starts with a UTF-8 BOM and has no trailing newline", () => {
      const raw = fixtureBytes();
      expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(raw[raw.length - 1]).not.toBe(0x0a);
    });

    it("serializes minified JSON with no BOM and no newline", () => {
      const json = NpnCodec.serialize(NpnCodec.parse(fixtureText()));
      expect(json.startsWith("{")).toBe(true);
      expect(json).not.toContain("\n");
      expect(json.charCodeAt(0)).not.toBe(0xfeff);
    });
  });

  describe("forward-compatibility", () => {
    it("preserves unknown per-element fields through a round-trip", () => {
      const input =
        '{"places":[{"id":"p","name":"P","tokens":0,"position":{"x":1,"y":2},"capacity":5}],"transitions":[],"arcs":{}}';
      const net = NpnCodec.parse(input);
      expect(net.places[0]._extra).toEqual({ capacity: 5 });
      expect(NpnCodec.serialize(net)).toBe(input);
    });

    it("leaves a missing optional labelPosition absent (in and out)", () => {
      const input =
        '{"places":[{"id":"p","name":"P","tokens":1,"position":{"x":0,"y":0}}],"transitions":[],"arcs":{}}';
      const net = NpnCodec.parse(input);
      expect(net.places[0].labelPosition).toBeUndefined();
      expect(NpnCodec.serialize(net)).toBe(input);
    });

    it("flattens the nested arc map and restores it on serialize", () => {
      const input =
        '{"places":[{"id":"p","name":"P","tokens":1,"position":{"x":0,"y":0}}],"transitions":[{"id":"t","name":"T","position":{"x":0,"y":0}}],"arcs":{"p":{"t":{"id":"a","srcMagnetic":true,"destMagnetic":false,"multiplicity":1,"points":[{"x":0,"y":0},{"x":1,"y":1}]}}}}';
      const net = NpnCodec.parse(input);
      expect(net.arcs).toHaveLength(1);
      expect(net.arcs[0]?.source).toBe("p");
      expect(net.arcs[0]?.target).toBe("t");
      expect(NpnCodec.serialize(net)).toBe(input);
    });
  });

  describe("arc key order", () => {
    const HEAD = '"id":"a","srcMagnetic":true,"destMagnetic":true,"multiplicity":2';
    const POINTS = '"points":[{"x":0,"y":0},{"x":40,"y":0}]';
    const LABEL = '"labelPosition":{"x":20,"y":-10}';
    /** A one-place, one-transition net whose single arc has the keys `arcKeys`, in that order. */
    const npn = (arcKeys: string): string =>
      `{"places":[{"id":"p","name":"P","tokens":1,"position":{"x":0,"y":0}}],"transitions":[{"id":"t","name":"T","position":{"x":40,"y":0}}],"arcs":{"p":{"t":{${arcKeys}}}}}`;

    it("keeps labelPosition before points when the file has it there", () => {
      const input = npn(`${HEAD},${LABEL},${POINTS}`);
      expect(NpnCodec.serialize(NpnCodec.parse(input))).toBe(input);
    });

    it("keeps labelPosition after points when the file has it there", () => {
      const input = npn(`${HEAD},${POINTS},${LABEL}`);
      expect(NpnCodec.serialize(NpnCodec.parse(input))).toBe(input);
    });

    it("keeps unknown arc fields last when labelPosition comes first", () => {
      const input = npn(`${HEAD},${LABEL},${POINTS},"gui":{"color":"red"}`);
      expect(NpnCodec.serialize(NpnCodec.parse(input))).toBe(input);
    });

    it("writes labelPosition after points for an arc made in this editor", () => {
      const net: PetriNet = {
        places: [{ id: "p", name: "P", tokens: 1, position: { x: 0, y: 0 } }],
        transitions: [{ id: "t", name: "T", position: { x: 40, y: 0 } }],
        arcs: [
          {
            id: "a",
            source: "p",
            target: "t",
            srcMagnetic: true,
            destMagnetic: true,
            multiplicity: 2,
            points: [
              { x: 0, y: 0 },
              { x: 40, y: 0 },
            ],
            labelPosition: { x: 20, y: -10 },
          },
        ],
      };
      expect(NpnCodec.serialize(net)).toBe(npn(`${HEAD},${POINTS},${LABEL}`));
    });

    it("writes a label added to an imported arc without one after points", () => {
      const net = NpnCodec.parse(npn(`${HEAD},${POINTS}`));
      const labelled: PetriNet = {
        ...net,
        arcs: net.arcs.map((a) => ({ ...a, labelPosition: { x: 20, y: -10 } })),
      };
      expect(NpnCodec.serialize(labelled)).toBe(npn(`${HEAD},${POINTS},${LABEL}`));
    });
  });

  describe("error handling", () => {
    it("throws NpnParseError on invalid JSON", () => {
      expect(() => NpnCodec.parse("{not json")).toThrow(NpnParseError);
    });

    it("throws a path-tagged error naming the missing required field", () => {
      const input =
        '{"places":[{"id":"p","tokens":0,"position":{"x":0,"y":0}}],"transitions":[],"arcs":{}}';
      expect(() => NpnCodec.parse(input)).toThrow(/places\[0\]\.name/);
    });

    it("throws when a required field has the wrong type", () => {
      const input =
        '{"places":[{"id":"p","name":"P","tokens":"lots","position":{"x":0,"y":0}}],"transitions":[],"arcs":{}}';
      expect(() => NpnCodec.parse(input)).toThrow(/tokens: expected a number/);
    });

    it("throws when the top level is not an object", () => {
      expect(() => NpnCodec.parse("[]")).toThrow(NpnParseError);
    });
  });
});
