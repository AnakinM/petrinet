import { NetOps } from "@/domain/netOps";
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

  /**
   * Parse PNML into the domain net. Uses the browser/jsdom `DOMParser` (no XML dependency), so it
   * runs in the app and under jsdom tests. Places/transitions/arcs are collected namespace-agnostically
   * across every page. Arc endpoints, absent from PNML, are re-derived by clipping to the node borders.
   */
  static parse(text: string): PetriNet {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new PnmlParseError("the file is not well-formed XML.");
    }
    const root = doc.documentElement;
    const rootName = root && PnmlCodec._local(root);
    if (rootName !== "pnml" && rootName !== "net") {
      throw new PnmlParseError("missing the <pnml> root element.");
    }

    const places: Place[] = [...doc.getElementsByTagNameNS("*", "place")].map((el) => {
      const id = PnmlCodec._id(el, "place");
      return {
        id,
        name: PnmlCodec._text(el, "name") ?? id,
        tokens: Math.max(0, PnmlCodec._int(PnmlCodec._text(el, "initialMarking"), 0)),
        position: PnmlCodec._position(el),
      };
    });
    const transitions: Transition[] = [...doc.getElementsByTagNameNS("*", "transition")].map(
      (el) => {
        const id = PnmlCodec._id(el, "transition");
        return { id, name: PnmlCodec._text(el, "name") ?? id, position: PnmlCodec._position(el) };
      },
    );

    // A node-only net so endpoint clipping can read the node geometry (NetOps reads it from `net`).
    const nodesOnly: PetriNet = { places, transitions, arcs: [] };
    const centerOf = new Map<string, Vec2>(
      [...places, ...transitions].map((n) => [n.id, n.position]),
    );
    const arcs: Arc[] = [...doc.getElementsByTagNameNS("*", "arc")].map((el) => {
      const id = PnmlCodec._id(el, "arc");
      const source = el.getAttribute("source") ?? "";
      const target = el.getAttribute("target") ?? "";
      const sCenter = centerOf.get(source);
      const tCenter = centerOf.get(target);
      if (!sCenter || !tCenter) {
        throw new PnmlParseError(`arc "${id}" references an unknown node.`);
      }
      const bends = PnmlCodec._bends(el);
      return {
        id,
        source,
        target,
        srcMagnetic: true,
        destMagnetic: true,
        multiplicity: Math.max(1, PnmlCodec._int(PnmlCodec._text(el, "inscription"), 1)),
        // Clip each endpoint to its node border toward the neighbouring bend (or the other centre).
        points: [
          NetOps.borderPoint(nodesOnly, source, bends[0] ?? tCenter),
          ...bends,
          NetOps.borderPoint(nodesOnly, target, bends[bends.length - 1] ?? sCenter),
        ],
      };
    });
    return { places, transitions, arcs };
  }

  private static _place(p: Place): string {
    const parts = [
      `      <place id="${PnmlCodec._esc(p.id)}">`,
      `        <name><text>${PnmlCodec._esc(p.name)}</text></name>`,
      `        <graphics>${PnmlCodec._positionTag(p.position)}</graphics>`,
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
      `        <graphics>${PnmlCodec._positionTag(t.position)}</graphics>`,
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
      for (const b of bends) inner.push(`          ${PnmlCodec._positionTag(b)}`);
      inner.push("        </graphics>");
    }
    return [open, ...inner, "      </arc>"].join("\n");
  }

  private static _positionTag(v: Vec2): string {
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

  /** An element's local name (namespace prefix stripped). */
  private static _local(el: Element): string {
    return el.localName;
  }

  /** The required `id` attribute, or a clear failure naming the offending element kind. */
  private static _id(el: Element, kind: string): string {
    const id = el.getAttribute("id");
    if (!id) throw new PnmlParseError(`a <${kind}> is missing its id.`);
    return id;
  }

  /** First direct child element with the given local name, or null. */
  private static _directChild(parent: Element, localName: string): Element | null {
    for (const child of parent.children) {
      if (child.localName === localName) return child;
    }
    return null;
  }

  /** Trimmed text of a PNML label (`<tag><text>…</text></tag>`), tolerating a direct text body; null if absent. */
  private static _text(el: Element, tag: string): string | null {
    const labelled = PnmlCodec._directChild(el, tag);
    if (!labelled) return null;
    const body = PnmlCodec._directChild(labelled, "text") ?? labelled;
    const text = body.textContent?.trim();
    return text ? text : null;
  }

  /** Parse an integer label value, falling back when absent or non-numeric. */
  private static _int(s: string | null, fallback: number): number {
    if (s === null) return fallback;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  /** A node's `<graphics><position>` as a point (origin when absent). */
  private static _position(el: Element): Vec2 {
    const graphics = PnmlCodec._directChild(el, "graphics");
    const position = graphics && PnmlCodec._directChild(graphics, "position");
    if (!position) return { x: 0, y: 0 };
    return { x: PnmlCodec._coord(position, "x"), y: PnmlCodec._coord(position, "y") };
  }

  /** An arc's interior bend points from its `<graphics>` positions (empty when absent). */
  private static _bends(arc: Element): Vec2[] {
    const graphics = PnmlCodec._directChild(arc, "graphics");
    if (!graphics) return [];
    const bends: Vec2[] = [];
    for (const child of graphics.children) {
      if (child.localName === "position") {
        bends.push({ x: PnmlCodec._coord(child, "x"), y: PnmlCodec._coord(child, "y") });
      }
    }
    return bends;
  }

  /** A numeric coordinate attribute, defaulting to 0. */
  private static _coord(el: Element, attr: string): number {
    const n = Number(el.getAttribute(attr));
    return Number.isFinite(n) ? n : 0;
  }

  private static readonly _XML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
}
