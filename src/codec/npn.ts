import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";

/** Thrown when `.npn` input is structurally invalid. Carries a specific, path-tagged message. */
export class NpnParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NpnParseError";
  }
}

/**
 * Byte-faithful codec for the `.npn` JSON format.
 *
 * Export reproduces the source byte-for-byte: keys are inserted in canonical order and
 * `JSON.stringify` (no spacing) preserves that order, so an unedited round-trip of a
 * `.npn` file is byte-identical once the {@link NpnCodec.BOM} is prepended on write.
 *
 * Import is lenient and forward-compatible: required fields are validated (malformed input
 * throws {@link NpnParseError} — never a silent partial load), optional fields default, and
 * unknown per-element fields are preserved in `_extra` so a future extended `.npn` round-trips.
 */
export class NpnCodec {
  /** UTF-8 byte-order mark; prepended to the serialized JSON when writing a file. */
  static readonly BOM = "﻿";

  // Canonical in-object key sets — anything else on an element is preserved via `_extra`.
  private static readonly PLACE_KEYS = ["id", "name", "tokens", "position", "labelPosition"];
  private static readonly TRANSITION_KEYS = ["id", "name", "position", "labelPosition", "gui"];
  private static readonly ARC_KEYS = [
    "id",
    "srcMagnetic",
    "destMagnetic",
    "multiplicity",
    "points",
    "labelPosition",
  ];

  /** Parse `.npn` text (a leading BOM is tolerated) into the domain model. */
  static parse(text: string): PetriNet {
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    let root: unknown;
    try {
      root = JSON.parse(body);
    } catch (error) {
      throw new NpnParseError(`Invalid JSON: ${(error as Error).message}`);
    }
    const r = NpnCodec.obj(root, "root");
    return {
      places: NpnCodec.arr(r.places, "places").map((p, i) =>
        NpnCodec.parsePlace(p, `places[${i}]`),
      ),
      transitions: NpnCodec.arr(r.transitions, "transitions").map((t, i) =>
        NpnCodec.parseTransition(t, `transitions[${i}]`),
      ),
      arcs: NpnCodec.parseArcs(r.arcs, "arcs"),
    };
  }

  /** Serialize the domain model to minified `.npn` JSON (no BOM, no trailing newline). */
  static serialize(net: PetriNet): string {
    return JSON.stringify({
      places: net.places.map((p) => NpnCodec.serializePlace(p)),
      transitions: net.transitions.map((t) => NpnCodec.serializeTransition(t)),
      arcs: NpnCodec.serializeArcs(net.arcs),
    });
  }

  // --- parse helpers ---------------------------------------------------------

  private static parsePlace(raw: unknown, path: string): Place {
    const o = NpnCodec.obj(raw, path);
    const place: Place = {
      id: NpnCodec.str(o.id, `${path}.id`),
      name: NpnCodec.str(o.name, `${path}.name`),
      tokens: NpnCodec.num(o.tokens, `${path}.tokens`),
      position: NpnCodec.vec(o.position, `${path}.position`),
    };
    if (o.labelPosition !== undefined) {
      place.labelPosition = NpnCodec.vec(o.labelPosition, `${path}.labelPosition`);
    }
    const extra = NpnCodec.extractExtra(o, NpnCodec.PLACE_KEYS);
    if (extra) place._extra = extra;
    return place;
  }

  private static parseTransition(raw: unknown, path: string): Transition {
    const o = NpnCodec.obj(raw, path);
    const transition: Transition = {
      id: NpnCodec.str(o.id, `${path}.id`),
      name: NpnCodec.str(o.name, `${path}.name`),
      position: NpnCodec.vec(o.position, `${path}.position`),
    };
    if (o.labelPosition !== undefined) {
      transition.labelPosition = NpnCodec.vec(o.labelPosition, `${path}.labelPosition`);
    }
    if (o.gui !== undefined) {
      const gui = NpnCodec.obj(o.gui, `${path}.gui`);
      transition.gui = { rotation: NpnCodec.num(gui.rotation, `${path}.gui.rotation`) };
    }
    const extra = NpnCodec.extractExtra(o, NpnCodec.TRANSITION_KEYS);
    if (extra) transition._extra = extra;
    return transition;
  }

  private static parseArcs(raw: unknown, path: string): Arc[] {
    const outer = NpnCodec.obj(raw, path);
    const arcs: Arc[] = [];
    for (const source of Object.keys(outer)) {
      const inner = NpnCodec.obj(outer[source], `${path}.${source}`);
      for (const target of Object.keys(inner)) {
        arcs.push(NpnCodec.parseArc(inner[target], source, target, `${path}.${source}.${target}`));
      }
    }
    return arcs;
  }

  private static parseArc(raw: unknown, source: string, target: string, path: string): Arc {
    const o = NpnCodec.obj(raw, path);
    const arc: Arc = {
      id: NpnCodec.str(o.id, `${path}.id`),
      source,
      target,
      srcMagnetic: NpnCodec.bool(o.srcMagnetic, `${path}.srcMagnetic`),
      destMagnetic: NpnCodec.bool(o.destMagnetic, `${path}.destMagnetic`),
      multiplicity: NpnCodec.num(o.multiplicity, `${path}.multiplicity`),
      points: NpnCodec.vecArray(o.points, `${path}.points`),
    };
    if (o.labelPosition !== undefined) {
      arc.labelPosition = NpnCodec.vec(o.labelPosition, `${path}.labelPosition`);
    }
    const extra = NpnCodec.extractExtra(o, NpnCodec.ARC_KEYS);
    if (extra) arc._extra = extra;
    return arc;
  }

  private static extractExtra(
    raw: Record<string, unknown>,
    known: readonly string[],
  ): Record<string, unknown> | undefined {
    let extra: Record<string, unknown> | undefined;
    for (const key of Object.keys(raw)) {
      if (known.includes(key)) continue;
      extra ??= {};
      extra[key] = raw[key];
    }
    return extra;
  }

  // --- serialize helpers -----------------------------------------------------

  private static serializePlace(p: Place): Record<string, unknown> {
    const o: Record<string, unknown> = {
      id: p.id,
      name: p.name,
      tokens: p.tokens,
      position: NpnCodec.vecOut(p.position),
    };
    if (p.labelPosition) o.labelPosition = NpnCodec.vecOut(p.labelPosition);
    if (p._extra) Object.assign(o, p._extra);
    return o;
  }

  private static serializeTransition(t: Transition): Record<string, unknown> {
    const o: Record<string, unknown> = {
      id: t.id,
      name: t.name,
      position: NpnCodec.vecOut(t.position),
    };
    if (t.labelPosition) o.labelPosition = NpnCodec.vecOut(t.labelPosition);
    if (t.gui) o.gui = { rotation: t.gui.rotation };
    if (t._extra) Object.assign(o, t._extra);
    return o;
  }

  private static serializeArcs(arcs: Arc[]): Record<string, Record<string, unknown>> {
    // Group by source into a Map (insertion-ordered), then materialize to a plain
    // object — reproducing the original outer/inner key order of the nested arc map.
    const bySource = new Map<string, Record<string, unknown>>();
    for (const a of arcs) {
      let inner = bySource.get(a.source);
      if (!inner) {
        inner = {};
        bySource.set(a.source, inner);
      }
      const o: Record<string, unknown> = {
        id: a.id,
        srcMagnetic: a.srcMagnetic,
        destMagnetic: a.destMagnetic,
        multiplicity: a.multiplicity,
        points: a.points.map((pt) => NpnCodec.vecOut(pt)),
      };
      if (a.labelPosition) o.labelPosition = NpnCodec.vecOut(a.labelPosition);
      if (a._extra) Object.assign(o, a._extra);
      inner[a.target] = o;
    }
    return Object.fromEntries(bySource);
  }

  private static vecOut(v: Vec2): Record<string, number> {
    return { x: v.x, y: v.y };
  }

  // --- primitive guards ------------------------------------------------------

  private static obj(v: unknown, path: string): Record<string, unknown> {
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new NpnParseError(`${path}: expected an object`);
    }
    return v as Record<string, unknown>;
  }

  private static arr(v: unknown, path: string): unknown[] {
    if (!Array.isArray(v)) throw new NpnParseError(`${path}: expected an array`);
    return v;
  }

  private static str(v: unknown, path: string): string {
    if (typeof v !== "string") throw new NpnParseError(`${path}: expected a string`);
    return v;
  }

  private static num(v: unknown, path: string): number {
    if (typeof v !== "number") throw new NpnParseError(`${path}: expected a number`);
    return v;
  }

  private static bool(v: unknown, path: string): boolean {
    if (typeof v !== "boolean") throw new NpnParseError(`${path}: expected a boolean`);
    return v;
  }

  private static vec(v: unknown, path: string): Vec2 {
    const o = NpnCodec.obj(v, path);
    return { x: NpnCodec.num(o.x, `${path}.x`), y: NpnCodec.num(o.y, `${path}.y`) };
  }

  private static vecArray(v: unknown, path: string): Vec2[] {
    return NpnCodec.arr(v, path).map((pt, i) => NpnCodec.vec(pt, `${path}[${i}]`));
  }
}
