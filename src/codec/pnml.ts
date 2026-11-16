import { GridSnap } from "@/domain/gridSnap";
import { NetOps } from "@/domain/netOps";
import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";

/**
 * Why a PNML file was refused. "invalid" is a broken file. The other three name a feature that this
 * editor lacks: a special arc, a net type other than place/transition, a place capacity.
 */
export type PnmlRefusalReason = "invalid" | "unsupported-arc" | "net-type" | "capacity";

/** A parsed place or transition, as an arc end needs it. */
interface NodeRef {
  position: Vec2;
  isPlace: boolean;
}

/** Thrown when PNML input is refused. Carries a specific, element-tagged message and its reason. */
export class PnmlParseError extends Error {
  readonly reason: PnmlRefusalReason;

  constructor(message: string, reason: PnmlRefusalReason = "invalid") {
    super(message);
    this.name = "PnmlParseError";
    this.reason = reason;
  }
}

/**
 * Codec for the ISO/IEC 15909-2 PNML interchange format (place/transition nets), a second,
 * standards-based format alongside the native `.npn`. Unlike `.npn` it is **not** byte-faithful: it
 * is a pretty-printed structural mapping for interop with other Petri net tools.
 *
 * Export writes one `<net>`/`<page>` of places, transitions and arcs: names, the initial marking
 * M0, weights and interior arc bends. Transition rotation and the exact arc end points (PNML derives
 * them from the nodes) are not represented in PNML and are dropped.
 * Import re-derives arc end points by clipping to the node borders, exactly as drawing an arc does.
 *
 * Import reads the PNML of PIPE, WoPeD, TAPAAL, TINA and the class tool (see `fixtures/pnml/`):
 * `<text>` or `<value>` labels, nodes with or without pages, any namespace, reference nodes. It
 * ignores what does not change how a classic net behaves: timing, rates, priorities, tool-specific
 * blocks, colours, fonts and node sizes. A file that would load and then behave differently (a
 * special arc, another net type, a capacity, a count that is not a number) or that is broken fails
 * with a specific {@link PnmlParseError} rather than loading partially.
 */
export class PnmlCodec {
  static readonly NS = "http://www.pnml.org/version-2009/grammar/pnml";
  static readonly PT_NET_TYPE = "http://www.pnml.org/version-2009/grammar/ptnet";
  /** Grid spacing for a file without positions: five canvas grid cells. */
  static readonly LAYOUT_STEP = 5 * GridSnap.SIZE;

  static serialize(net: PetriNet): string {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<pnml xmlns="${PnmlCodec.NS}">`,
      `  <net id="net1" type="${PnmlCodec.PT_NET_TYPE}">`,
      '    <page id="page1">',
      ...net.places.map((p) => PnmlCodec._placeXml(p)),
      ...net.transitions.map((t) => PnmlCodec._transitionXml(t)),
      ...net.arcs.map((a) => PnmlCodec._arcXml(a)),
      "    </page>",
      "  </net>",
      "</pnml>",
    ];
    return lines.join("\n");
  }

  /**
   * Parse PNML into the domain net. Uses the browser/jsdom `DOMParser` (no XML dependency), so it
   * runs in the app and under jsdom tests. Elements are matched by local name, so any namespace (or
   * none) works. Arc endpoints, absent from PNML, are re-derived by clipping to the node borders.
   */
  static parse(text: string): PetriNet {
    const netEl = PnmlCodec._singleNet(text);
    const found = PnmlCodec._elements(netEl);
    const all = (kind: string): Element[] => found.get(kind) ?? [];
    PnmlCodec._checkUniqueIds(found);

    const nodeEls = [...all("place"), ...all("transition")];
    const positioned = nodeEls.some((el) => PnmlCodec._position(el) !== null);
    const positionAt = (el: Element, index: number): Vec2 =>
      positioned
        ? (PnmlCodec._position(el) ?? { x: 0, y: 0 })
        : PnmlCodec._gridPoint(index, nodeEls.length);
    const absoluteLabels = PnmlCodec._writtenByWoped(netEl);

    const places = all("place").map((el, i) =>
      PnmlCodec._readPlace(el, positionAt(el, i), absoluteLabels),
    );
    const transitions = all("transition").map((el, i) =>
      PnmlCodec._readTransition(el, positionAt(el, places.length + i), absoluteLabels),
    );

    // A node-only net so endpoint clipping can read the node geometry (NetOps reads it from `net`).
    const nodesOnly: PetriNet = { places, transitions, arcs: [] };
    const nodes = new Map<string, NodeRef>();
    for (const p of places) nodes.set(p.id, { position: p.position, isPlace: true });
    for (const t of transitions) nodes.set(t.id, { position: t.position, isPlace: false });
    const refs = PnmlCodec._references(found);
    const arcs = all("arc").map((el) => PnmlCodec._readArc(el, nodesOnly, nodes, refs));
    return { places, transitions, arcs };
  }

  private static _placeXml(p: Place): string {
    const parts = [
      `      <place id="${PnmlCodec._esc(p.id)}">`,
      `        <name><text>${PnmlCodec._esc(p.name)}</text></name>`,
      `        <graphics>${PnmlCodec._pointXml("position", p.position)}</graphics>`,
    ];
    // Omit a zero initial marking: import defaults it to 0 anyway.
    if (p.tokens > 0)
      parts.push(`        <initialMarking><text>${p.tokens}</text></initialMarking>`);
    parts.push("      </place>");
    return parts.join("\n");
  }

  private static _transitionXml(t: Transition): string {
    return [
      `      <transition id="${PnmlCodec._esc(t.id)}">`,
      `        <name><text>${PnmlCodec._esc(t.name)}</text></name>`,
      `        <graphics>${PnmlCodec._pointXml("position", t.position)}</graphics>`,
      "      </transition>",
    ].join("\n");
  }

  private static _arcXml(a: Arc): string {
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
      for (const b of bends) inner.push(`          ${PnmlCodec._pointXml("position", b)}`);
      inner.push("        </graphics>");
    }
    return [open, ...inner, "      </arc>"].join("\n");
  }

  private static _pointXml(tag: string, v: Vec2): string {
    return `<${tag} x="${PnmlCodec._num(v.x)}" y="${PnmlCodec._num(v.y)}"/>`;
  }

  /** Round to 2 decimals so coordinates stay compact. */
  private static _num(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Escape XML-significant characters for both attribute values and text content. */
  private static _esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => PnmlCodec._XML_ESCAPES[c]);
  }

  /** The one `<net>` of a well-formed PNML document. A file with several nets is refused. */
  private static _singleNet(text: string): Element {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) {
      throw new PnmlParseError("the file is not well-formed XML.");
    }
    const rootName = doc.documentElement.localName;
    if (rootName !== "pnml" && rootName !== "net") {
      throw new PnmlParseError("missing the <pnml> root element.");
    }
    // Every <net> counts, also one nested in a page, as WoPeD writes a subprocess.
    const nets = doc.getElementsByTagNameNS("*", "net");
    if (nets.length === 0) throw new PnmlParseError("the file has no <net> element.");
    if (nets.length > 1) {
      throw new PnmlParseError(
        `the file holds ${nets.length} nets. This editor opens one net per file.`,
      );
    }
    PnmlCodec._checkNetType(nets[0]);
    return nets[0];
  }

  /**
   * Refuse a net whose type is not a place/transition net, such as a coloured net, whose tokens
   * and weights would be lost. Accepted: no type, the 2009 `ptnet` and the older `ptNetb`
   * addresses (WoPeD), PIPE's "P/T net", and TINA's "tpn", a P/T net plus timing (ignored) and
   * special arcs (refused one by one).
   */
  private static _checkNetType(netEl: Element): void {
    const type = netEl.getAttribute("type")?.trim() ?? "";
    const lower = type.toLowerCase();
    const isPtNet =
      lower === "" ||
      lower === "p/t net" ||
      lower === "http://www.laas.fr/tina/tpn" ||
      /ptnetb?(\.pntd)?$/.test(lower);
    if (!isPtNet) {
      throw new PnmlParseError(
        `the net type "${type}" is not a place/transition net. This editor opens only place/transition nets.`,
        "net-type",
      );
    }
  }

  /**
   * The direct children of the net and of its pages (nested pages too), grouped by local name.
   * Tool-specific blocks are never searched, so a `<position>` or `<place>` inside one is not read.
   */
  private static _elements(netEl: Element): Map<string, Element[]> {
    const found = new Map<string, Element[]>();
    const visit = (container: Element): void => {
      for (const child of container.children) {
        if (child.localName === "page") {
          visit(child);
          continue;
        }
        const list = found.get(child.localName);
        if (list) list.push(child);
        else found.set(child.localName, [child]);
      }
    };
    visit(netEl);
    return found;
  }

  /** Every place, transition, arc and reference node needs an id that no other one uses. */
  private static _checkUniqueIds(found: Map<string, Element[]>): void {
    const seen = new Set<string>();
    for (const kind of PnmlCodec._ID_KINDS) {
      for (const el of found.get(kind) ?? []) {
        const id = PnmlCodec._id(el, kind);
        if (seen.has(id)) {
          throw new PnmlParseError(`the id "${id}" is used by more than one element.`);
        }
        seen.add(id);
      }
    }
  }

  private static _readPlace(el: Element, position: Vec2, absoluteLabels: boolean): Place {
    const id = PnmlCodec._id(el, "place");
    const owner = `place "${id}"`;
    // PIPE writes a capacity; 0 means unlimited. A real limit changes when transitions may fire.
    const capacity = PnmlCodec._count(el, "capacity", owner, "capacity");
    if (capacity !== null && capacity > 0) {
      throw new PnmlParseError(
        `${owner} has a capacity of ${capacity}. This editor does not support place capacities.`,
        "capacity",
      );
    }
    const place: Place = {
      id,
      name: PnmlCodec._text(el, "name") ?? id,
      tokens: PnmlCodec._count(el, "initialMarking", owner, "initial marking") ?? 0,
      position,
    };
    const labelPosition = PnmlCodec._labelPosition(el, position, absoluteLabels);
    if (labelPosition) place.labelPosition = labelPosition;
    return place;
  }

  private static _readTransition(el: Element, position: Vec2, absoluteLabels: boolean): Transition {
    const id = PnmlCodec._id(el, "transition");
    const transition: Transition = { id, name: PnmlCodec._text(el, "name") ?? id, position };
    const labelPosition = PnmlCodec._labelPosition(el, position, absoluteLabels);
    if (labelPosition) transition.labelPosition = labelPosition;
    return transition;
  }

  private static _readArc(
    el: Element,
    nodesOnly: PetriNet,
    nodes: Map<string, NodeRef>,
    refs: Map<string, string>,
  ): Arc {
    const id = PnmlCodec._id(el, "arc");
    const owner = `arc "${id}"`;
    const type = PnmlCodec._arcType(el);
    if (type !== null && type.toLowerCase() !== "normal") {
      throw new PnmlParseError(
        `${owner} has the type "${type}". This editor supports only normal arcs.`,
        "unsupported-arc",
      );
    }
    const source = PnmlCodec._endpoint(el, "source", owner, nodes, refs);
    const target = PnmlCodec._endpoint(el, "target", owner, nodes, refs);
    if (source.isPlace === target.isPlace) {
      const kind = source.isPlace ? "places" : "transitions";
      throw new PnmlParseError(
        `${owner} joins two ${kind}, "${source.id}" and "${target.id}". An arc must join a place and a transition.`,
      );
    }
    const weight = PnmlCodec._count(el, "inscription", owner, "weight") ?? 1;
    if (weight < 1) {
      throw new PnmlParseError(`${owner} has the weight 0. A weight must be 1 or more.`);
    }

    const bends = PnmlCodec._bends(el);
    return {
      id,
      source: source.id,
      target: target.id,
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: weight,
      // Clip each endpoint to its node border toward the neighbouring bend (or the other centre).
      points: [
        NetOps.borderPoint(nodesOnly, source.id, bends[0] ?? target.position),
        ...bends,
        NetOps.borderPoint(nodesOnly, target.id, bends[bends.length - 1] ?? source.position),
      ],
    };
  }

  /** An arc end as the real node it reaches, following reference nodes. */
  private static _endpoint(
    el: Element,
    end: "source" | "target",
    owner: string,
    nodes: Map<string, NodeRef>,
    refs: Map<string, string>,
  ): NodeRef & { id: string } {
    const written = el.getAttribute(end) ?? "";
    const id = PnmlCodec._resolve(written, refs);
    const node = nodes.get(id);
    if (!node) throw new PnmlParseError(`${owner} references an unknown node "${written}".`);
    return { id, ...node };
  }

  /**
   * Reference places and transitions (in nets that span several pages) stand for a node that may
   * sit on another page. Maps each reference id to the id it points at.
   */
  private static _references(found: Map<string, Element[]>): Map<string, string> {
    const refs = new Map<string, string>();
    for (const kind of ["referencePlace", "referenceTransition"]) {
      for (const el of found.get(kind) ?? []) {
        const id = PnmlCodec._id(el, kind);
        const ref = el.getAttribute("ref");
        if (!ref) throw new PnmlParseError(`the <${kind}> "${id}" has no ref attribute.`);
        refs.set(id, ref);
      }
    }
    return refs;
  }

  /** Follow a chain of references (a reference may point at another reference) to a real node. */
  private static _resolve(id: string, refs: Map<string, string>): string {
    const visited = new Set<string>();
    let current = id;
    for (let next = refs.get(current); next !== undefined; next = refs.get(current)) {
      if (visited.has(current)) {
        throw new PnmlParseError(`the reference "${id}" leads round in a circle.`);
      }
      visited.add(current);
      current = next;
    }
    return current;
  }

  /** An arc's type: TAPAAL writes a `type` attribute, PIPE and TINA a `<type value>` element. */
  private static _arcType(el: Element): string | null {
    const label = PnmlCodec._directChild(el, "type");
    const type =
      el.getAttribute("type") || label?.getAttribute("value") || PnmlCodec._text(el, "type");
    return type ? type.trim() : null;
  }

  /** WoPeD marks its blocks with `tool="WoPeD"`, and it writes name offsets differently. */
  private static _writtenByWoped(netEl: Element): boolean {
    return [...netEl.getElementsByTagNameNS("*", "toolspecific")].some(
      (el) => el.getAttribute("tool") === "WoPeD",
    );
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

  /**
   * Trimmed text of a PNML label: `<tag><text>…</text></tag>` in the standard, `<tag><value>…`
   * in PIPE, or a direct text body. Null if absent or empty.
   */
  private static _text(el: Element, tag: string): string | null {
    const label = PnmlCodec._directChild(el, tag);
    if (!label) return null;
    const body =
      PnmlCodec._directChild(label, "text") ?? PnmlCodec._directChild(label, "value") ?? label;
    const text = body.textContent?.trim();
    return text ? text : null;
  }

  /**
   * A whole-number label (a marking, a weight, a capacity), or null when absent. PIPE writes a
   * token colour before the count ("Default,1"), so one such prefix is skipped. More colours mean
   * a coloured net, and any other text that is not a whole number is refused.
   */
  private static _count(el: Element, tag: string, owner: string, what: string): number | null {
    const raw = PnmlCodec._text(el, tag);
    if (raw === null) return null;
    const parts = raw.split(",");
    if (parts.length > 2) {
      throw new PnmlParseError(
        `${owner} has tokens of several colours in its ${what} ("${raw}"). This editor opens only place/transition nets.`,
        "net-type",
      );
    }
    const count = parts[parts.length - 1].trim();
    if (!/^\d+$/.test(count)) {
      throw new PnmlParseError(`${owner} has the ${what} "${raw}", which is not a whole number.`);
    }
    return Number(count);
  }

  /** A node's `<graphics><position>` as a point, or null when absent. */
  private static _position(el: Element): Vec2 | null {
    const graphics = PnmlCodec._directChild(el, "graphics");
    const position = graphics && PnmlCodec._directChild(graphics, "position");
    return position ? PnmlCodec._point(position) : null;
  }

  /** Grid slot `index` of `count` nodes, in a square block, for a file that has no positions. */
  private static _gridPoint(index: number, count: number): Vec2 {
    const columns = Math.ceil(Math.sqrt(count));
    return {
      x: (index % columns) * PnmlCodec.LAYOUT_STEP,
      y: Math.floor(index / columns) * PnmlCodec.LAYOUT_STEP,
    };
  }

  /**
   * A node's name offset (`<name><graphics><offset>`) as the domain's `labelPosition`: the label
   * centre relative to the node centre, the same reading as the class tool. WoPeD writes where the
   * label sits on the canvas, so its offset is taken relative to the node. An offset that puts the
   * label on the node itself (PIPE often writes 0, 0) would hide the name, so the default spot wins.
   */
  private static _labelPosition(el: Element, position: Vec2, absolute: boolean): Vec2 | undefined {
    const name = PnmlCodec._directChild(el, "name");
    const graphics = name && PnmlCodec._directChild(name, "graphics");
    const offset = graphics && PnmlCodec._directChild(graphics, "offset");
    if (!offset) return undefined;
    const point = PnmlCodec._point(offset);
    const relative = absolute ? { x: point.x - position.x, y: point.y - position.y } : point;
    const onNode = Math.hypot(relative.x, relative.y) < NodeGeometry.PLACE_RADIUS;
    return onNode ? undefined : relative;
  }

  /**
   * An arc's interior bend points: the standard `<graphics><position>`s, or else the inner points
   * of PIPE's `<arcpath>` list, which also holds both end points.
   */
  private static _bends(arc: Element): Vec2[] {
    const graphics = PnmlCodec._directChild(arc, "graphics");
    const bends = graphics ? PnmlCodec._points(graphics, "position") : [];
    return bends.length > 0 ? bends : PnmlCodec._points(arc, "arcpath").slice(1, -1);
  }

  /** The `x`/`y` points of every direct child with the given local name. */
  private static _points(parent: Element, localName: string): Vec2[] {
    return [...parent.children]
      .filter((child) => child.localName === localName)
      .map((child) => PnmlCodec._point(child));
  }

  private static _point(el: Element): Vec2 {
    return { x: PnmlCodec._coord(el, "x"), y: PnmlCodec._coord(el, "y") };
  }

  /** A numeric coordinate attribute, defaulting to 0. */
  private static _coord(el: Element, attr: string): number {
    const n = Number(el.getAttribute(attr));
    return Number.isFinite(n) ? n : 0;
  }

  /** The element kinds that carry ids which arcs and references point at. */
  private static readonly _ID_KINDS = [
    "place",
    "transition",
    "arc",
    "referencePlace",
    "referenceTransition",
  ];

  private static readonly _XML_ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  };
}
