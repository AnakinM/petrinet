import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NpnCodec, NpnParseError } from "@/codec/npn";

// The reference sample is gitignored (kept local, never committed). Tests that need
// it skip cleanly when it is absent — e.g. a fresh checkout without the local file.
const FIXTURE = new URL("../../export-12.npn", import.meta.url);
const hasFixture = existsSync(FIXTURE);
const fixtureBytes = (): Uint8Array => new Uint8Array(readFileSync(FIXTURE));
const fixtureText = (): string => new TextDecoder().decode(fixtureBytes());

describe("NpnCodec", () => {
  describe.skipIf(!hasFixture)("round-trip fidelity (local export-12.npn)", () => {
    it("re-serializes export-12.npn byte-identically", () => {
      const raw = fixtureBytes();
      const out = new TextEncoder().encode(
        NpnCodec.BOM + NpnCodec.serialize(NpnCodec.parse(fixtureText())),
      );

      const limit = Math.min(raw.length, out.length);
      let firstDiff = raw.length === out.length ? -1 : limit;
      for (let i = 0; i < limit; i++) {
        if (raw[i] !== out[i]) {
          firstDiff = i;
          break;
        }
      }
      expect(firstDiff).toBe(-1);
      expect(out.length).toBe(raw.length);
    });

    it("parses the expected element counts", () => {
      const net = NpnCodec.parse(fixtureText());
      expect(net.places).toHaveLength(45);
      expect(net.transitions).toHaveLength(65);
      expect(net.arcs).toHaveLength(170);
    });
  });

  describe.skipIf(!hasFixture)("byte format (local export-12.npn)", () => {
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
