import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";

/** Thrown when PNML input is structurally invalid. Carries a specific, element-tagged message. */
export class PnmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PnmlParseError";
  }
}

/**
 * Codec for the ISO/IEC 15909-2 PNML interchange format (Place/Transition nets) — a second,
 * standards-based format alongside the native `.npn`. Unlike `.npn` it is **not** byte-faithful: it
 * is a pretty-printed, lossy-but-faithful structural mapping for interop with other Petri-net tools.
 *
 * Export writes one `<net>`/`<page>` of places, transitions and arcs. Transition rotation and arc
 * endpoint geometry (PNML stores only interior bend points, deriving endpoints from node positions)
 * are not represented in PNML and are dropped; import re-derives arc endpoints by clipping to the
 * node borders, exactly as drawing an arc does.
 *
 * Import is lenient: missing optional fields default (initial marking 0, weight 1), but malformed
 * input — bad XML, a missing root, an element without an id, an arc to an unknown node — fails with a
 * specific {@link PnmlParseError} rather than loading partially.
 */
export class PnmlCodec {
  static readonly NS = "http://www.pnml.org/version-2009/grammar/pnml";
  static readonly PT_NET_TYPE = "http://www.pnml.org/version-2009/grammar/ptnet";

  static serialize(net: PetriNet): string {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<pnml xmlns="${PnmlCodec.NS}">`,
      `  <net id="net1" type="${PnmlCodec.PT_NET_TYPE}">`,
      '    <page id="page1">',
      ...net.places.map((p) => PnmlCodec._place(p)),
      ...net.transitions.map((t) => PnmlCodec._transition(t)),
      ...net.arcs.map((a) => PnmlCodec._arc(a)),
      "    </page>",
      "  </net>",
      "</pnml>",
    ];
    return lines.join("\n");
  }

  private static _place(p: Place): string {
    const parts = [
      `      <place id="${PnmlCodec._esc(p.id)}">`,
      `        <name><text>${PnmlCodec._esc(p.name)}</text></name>`,
      `        <graphics>${PnmlCodec._position(p.position)}</graphics>`,
    ];
    // Omit a zero initial marking — import defaults it to 0 anyway.
    if (p.tokens > 0)
      parts.push(`        <initialMarking><text>${p.tokens}</text></initialMarking>`);
    parts.push("      </place>");
    return parts.join("\n");
  }

  private static _transition(t: Transition): string {
    return [
      `      <transition id="${PnmlCodec._esc(t.id)}">`,
      `        <name><text>${PnmlCodec._esc(t.name)}</text></name>`,
      `        <graphics>${PnmlCodec._position(t.position)}</graphics>`,
      "      </transition>",
    ].join("\n");
  }

  private static _arc(a: Arc): string {
    const open = `      <arc id="${PnmlCodec._esc(a.id)}" source="${PnmlCodec._esc(a.source)}" target="${PnmlCodec._esc(a.target)}">`;
    const inner: string[] = [];
    // Weight 1 is the default; emit an inscription only when it differs.
    if (a.multiplicity > 1) {
      inner.push(`        <inscription><text>${a.multiplicity}</text></inscription>`);
    }
    // PNML arc graphics carry only the interior bend points; endpoints are derived from the nodes.
    const bends = a.points.slice(1, -1);
    if (bends.length > 0) {
      inner.push("        <graphics>");
      for (const b of bends) inner.push(`          ${PnmlCodec._position(b)}`);
      inner.push("        </graphics>");
    }
    return [open, ...inner, "      </arc>"].join("\n");
  }

  private static _position(v: Vec2): string {
    return `<position x="${PnmlCodec._num(v.x)}" y="${PnmlCodec._num(v.y)}"/>`;
  }

  /** Round to 2 decimals so coordinates stay compact. */
  private static _num(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Escape XML-significant characters for both attribute values and text content. */
  private static _esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => PnmlCodec._XML_ESCAPES[c]);
  }

  private static readonly _XML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
}
