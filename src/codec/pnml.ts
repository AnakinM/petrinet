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
 * Export writes one `<net>`/`<page>` of places, transitions and arcs: names with their label
 * offsets, the initial marking M0, weights and interior arc bends. Standard PNML has no place for
 * three things, so they are lost: transition rotation, the exact arc end points (PNML derives them
 * from the nodes, so a free end becomes a magnetic one) and the position of an arc's weight label.
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

    const positions = PnmlCodec._positions([...all("place"), ...all("transition")]);
    const absoluteLabels = PnmlCodec._writtenByWoped(netEl);

    const places = all("place").map((el, i) =>
      PnmlCodec._readPlace(el, positions[i], absoluteLabels),
    );
    const transitions = all("transition").map((el, i) =>
      PnmlCodec._readTransition(el, positions[places.length + i], absoluteLabels),
    );

    // A node-only net so endpoint clipping can read the node geometry (NetOps reads it from `net`).
    const nodesOnly: PetriNet = { places, transitions, arcs: [] };
    const nodes = new Map<string, NodeRef>();
    for (const p of places) nodes.set(p.id, { position: p.position, isPlace: true });
    for (const t of transitions) nodes.set(t.id, { position: t.position, isPlace: false });
    const refs = PnmlCodec._references(found, nodes);
    const arcs = all("arc").map((el) => PnmlCodec._readArc(el, nodesOnly, nodes, refs));
    PnmlCodec._checkParallelArcs(arcs);
    return { places, transitions, arcs };
  }

  private static _placeXml(p: Place): string {
    const parts = [
      `      <place id="${PnmlCodec._esc(p.id)}">`,
      PnmlCodec._nameXml(p.name, p.labelPosition),
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
      PnmlCodec._nameXml(t.name, t.labelPosition),
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

  /** A node's name label; a moved label also gets its offset from the node centre. */
  private static _nameXml(name: string, labelPosition: Vec2 | undefined): string {
    const offset = labelPosition
      ? `<graphics>${PnmlCodec._pointXml("offset", labelPosition)}</graphics>`
      : "";
    return `        <name><text>${PnmlCodec._esc(name)}</text>${offset}</name>`;
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
    PnmlCodec._checkNotTapn(doc.documentElement);
    // Every <net> counts, also one nested in a page, as WoPeD writes a subprocess.
    const nets = [...doc.getElementsByTagNameNS("*", "net")];
    if (nets.length === 0) throw new PnmlParseError("the file has no <net> element.");
    if (nets.some((n) => n.parentElement?.localName === "page")) {
      throw new PnmlParseError(
        "the file holds a subprocess, a second net inside a page. This editor opens one net per file.",
      );
    }
    if (nets.length > 1) {
      throw new PnmlParseError(
        `the file holds ${nets.length} nets. This editor opens one net per file.`,
      );
    }
    PnmlCodec._checkNetType(nets[0]);
    return nets[0];
  }

  /**
   * TAPAAL's own `.tapn` file has a `<pnml>` root, but it keeps values in attributes (a place's
   * `initialMarking`) and its timed and transport arcs belong to timed-arc nets, another net type.
   */
  private static _checkNotTapn(root: Element): void {
    const timedArc = [...root.getElementsByTagNameNS("*", "arc")].some((el) =>
      /^(timed|transport)$/i.test(el.getAttribute("type") ?? ""),
    );
    const markingAttribute = [...root.getElementsByTagNameNS("*", "place")].some((el) =>
      el.hasAttribute("initialMarking"),
    );
    if (timedArc || markingAttribute) {
      throw new PnmlParseError(
        "the file is a TAPAAL net (.tapn), not PNML. In TAPAAL, export the net as PNML and open that file.",
        timedArc ? "net-type" : "invalid",
      );
    }
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
      /(^|\/)ptnetb?(\.pntd)?$/.test(lower);
    if (!isPtNet) {
      throw new PnmlParseError(
        `the net type "${type}" is not a place/transition net. This editor opens only place/transition nets.`,
        "net-type",
      );
    }
    // Without a type, high-level labels still give a coloured or other high-level net away.
    const highLevel = PnmlCodec._HIGH_LEVEL_LABELS.find(
      (tag) => netEl.getElementsByTagNameNS("*", tag).length > 0,
    );
    if (type === "" && highLevel) {
      throw new PnmlParseError(
        `the net has no type but uses the high-level label <${highLevel}>. This editor opens only place/transition nets.`,
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
    // Some tools write special arcs as their own elements, such as <inhibitorArc> or <resetArc>.
    for (const [name, list] of found) {
      if (name !== "arc" && /arc$/i.test(name)) {
        throw new PnmlParseError(
          `the file has an <${name}> "${list[0].getAttribute("id") ?? ""}". This editor supports only normal arcs.`,
          "unsupported-arc",
        );
      }
    }
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

  /**
   * The written position of each node. Nodes without one go on a grid: at the origin when no
   * node has a position, otherwise below the lowest placed node.
   */
  private static _positions(nodeEls: Element[]): Vec2[] {
    const written = nodeEls.map((el) => PnmlCodec._position(el));
    const placed = written.filter((p): p is Vec2 => p !== null);
    const origin =
      placed.length === 0
        ? { x: 0, y: 0 }
        : {
            x: placed.reduce((min, p) => Math.min(min, p.x), Infinity),
            y: placed.reduce((max, p) => Math.max(max, p.y), -Infinity) + PnmlCodec.LAYOUT_STEP,
          };
    const unplaced = written.length - placed.length;
    let slot = 0;
    return written.map((p) => p ?? PnmlCodec._gridPoint(slot++, unplaced, origin));
  }

  /**
   * The engine checks each input arc alone and then subtracts them all, so two arcs from one place
   * to one transition could take more tokens than the place holds. Refuse such a repeat.
   */
  private static _checkParallelArcs(arcs: Arc[]): void {
    const seen = new Map<string, string>();
    for (const arc of arcs) {
      const key = JSON.stringify([arc.source, arc.target]);
      const earlier = seen.get(key);
      if (earlier !== undefined) {
        throw new PnmlParseError(
          `arcs "${earlier}" and "${arc.id}" both go from "${arc.source}" to "${arc.target}". This editor allows one arc each way between two nodes.`,
        );
      }
      seen.set(key, arc.id);
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
    const type = PnmlCodec._arcTypes(el).find((t) => t.toLowerCase() !== "normal");
    if (type !== undefined) {
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
    const written = el.getAttribute(end);
    if (!written) throw new PnmlParseError(`${owner} has no ${end}.`);
    const id = refs.get(written) ?? written;
    const node = nodes.get(id);
    if (!node) throw new PnmlParseError(`${owner} references an unknown node "${written}".`);
    return { id, ...node };
  }

  /**
   * Reference places and transitions (in nets that span several pages) stand for a node that may
   * sit on another page. Maps each reference id to the real node it ends at, which must exist and
   * be of the same kind.
   */
  private static _references(
    found: Map<string, Element[]>,
    nodes: Map<string, NodeRef>,
  ): Map<string, string> {
    const refs = new Map<string, { ref: string; isPlace: boolean }>();
    for (const kind of ["referencePlace", "referenceTransition"]) {
      for (const el of found.get(kind) ?? []) {
        const id = PnmlCodec._id(el, kind);
        const ref = el.getAttribute("ref");
        if (!ref) throw new PnmlParseError(`the <${kind}> "${id}" has no ref attribute.`);
        refs.set(id, { ref, isPlace: kind === "referencePlace" });
      }
    }
    const resolved = new Map<string, string>();
    for (const [id, { isPlace }] of refs) {
      const target = PnmlCodec._resolve(id, refs);
      const node = nodes.get(target);
      if (!node) {
        throw new PnmlParseError(
          `the reference "${id}" points to "${target}", which is not in the file.`,
        );
      }
      if (node.isPlace !== isPlace) {
        const [own, other] = isPlace ? ["place", "transition"] : ["transition", "place"];
        throw new PnmlParseError(
          `the reference ${own} "${id}" points to the ${other} "${target}". It must point to a ${own}.`,
        );
      }
      resolved.set(id, target);
    }
    return resolved;
  }

  /** Follow a chain of references (a reference may point at another reference) to its end. */
  private static _resolve(id: string, refs: Map<string, { ref: string }>): string {
    const visited = new Set<string>();
    let current = id;
    for (let next = refs.get(current); next !== undefined; next = refs.get(current)) {
      if (visited.has(current)) {
        throw new PnmlParseError(`the reference "${id}" leads round in a circle.`);
      }
      visited.add(current);
      current = next.ref;
    }
    return current;
  }

  /**
   * Every type an arc states: TAPAAL writes a `type` attribute, PIPE and TINA a `<type value>`
   * element, others a `<type>` label. All of them are checked, so one cannot hide another.
   */
  private static _arcTypes(el: Element): string[] {
    const label = PnmlCodec._directChild(el, "type");
    return [el.getAttribute("type"), label?.getAttribute("value"), PnmlCodec._text(el, "type")]
      .map((type) => type?.trim() ?? "")
      .filter((type) => type !== "");
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
   * A whole-number label (a marking, a weight, a capacity), or null when absent. PIPE writes the
   * token colour before the count ("Default,1"). Its plain "Default" colour is skipped; any other
   * colour, or several, mean a coloured net. Any other text that is not a whole number is refused.
   */
  private static _count(el: Element, tag: string, owner: string, what: string): number | null {
    const raw = PnmlCodec._text(el, tag);
    if (raw === null) return null;
    const notWhole = (): PnmlParseError =>
      new PnmlParseError(`${owner} has the ${what} "${raw}", which is not a whole number.`);
    const parts = raw.split(",").map((part) => part.trim());
    if (parts.length > 1) {
      const colour = parts[0];
      // An empty or numeric prefix ("1,000", ",3") is a malformed number, not a colour.
      if (colour === "" || Number.isFinite(Number(colour))) throw notWhole();
      if (parts.length > 2 || colour.toLowerCase() !== "default") {
        const colours = parts.length > 2 ? "several colours" : `the colour "${colour}"`;
        throw new PnmlParseError(
          `${owner} has tokens of ${colours} in its ${what} ("${raw}"). This editor opens only place/transition nets, where all tokens are alike.`,
          "net-type",
        );
      }
    }
    const count = parts[parts.length - 1];
    if (!/^\d+$/.test(count) || !Number.isSafeInteger(Number(count))) throw notWhole();
    return Number(count);
  }

  /** A node's `<graphics><position>` as a point, or null when absent. */
  private static _position(el: Element): Vec2 | null {
    const graphics = PnmlCodec._directChild(el, "graphics");
    const position = graphics && PnmlCodec._directChild(graphics, "position");
    return position ? PnmlCodec._point(position) : null;
  }

  /** Grid slot `index` of `count` unplaced nodes, in a square block from `origin`. */
  private static _gridPoint(index: number, count: number, origin: Vec2): Vec2 {
    const columns = Math.ceil(Math.sqrt(count));
    return {
      x: origin.x + (index % columns) * PnmlCodec.LAYOUT_STEP,
      y: origin.y + Math.floor(index / columns) * PnmlCodec.LAYOUT_STEP,
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

  /** Labels that only high-level nets (coloured nets and the like) have. */
  private static readonly _HIGH_LEVEL_LABELS = ["hlinitialMarking", "hlinscription", "declaration"];

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
