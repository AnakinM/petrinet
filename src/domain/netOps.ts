import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";
import { newId } from "@/lib/id";

/** Which side of an arc an endpoint sits on. */
export type ArcEnd = "src" | "dest";

/** A node's kind — used to scope name-uniqueness checks (places and transitions namespace separately). */
export type NodeKind = "place" | "transition";

/** What {@link NetOps.paste} produced: the new net plus the ids of the inserted nodes and arcs. */
export interface PasteResult {
  net: PetriNet;
  nodeIds: string[];
  arcIds: string[];
}

/**
 * Immutable Build-mode transforms on the {@link PetriNet}. Every method returns a NEW net
 * (inputs are never mutated) so the store's zundo history can snapshot each edit; a no-op
 * input returns the net unchanged.
 *
 * Geometry follows the magnetic model (see the node-drag rules): {@link NetOps.moveNode}
 * **translates** magnetic endpoints with the node rather than re-clipping them, preserving
 * an imported endpoint's exact border offset. Border clipping via {@link NodeGeometry}
 * happens only for a *fresh* endpoint — a new arc or a free→magnetic toggle.
 */
export class NetOps {
  // --- create ---------------------------------------------------------------

  /** Append a new place (0 tokens) centered at `position`, auto-named to the next free `P<n>`. */
  static addPlace(net: PetriNet, position: Vec2): PetriNet {
    const place: Place = { id: newId(), name: NetOps._freeName(net, "place"), tokens: 0, position };
    return { ...net, places: [...net.places, place] };
  }

  /** Append a new (unrotated) transition centered at `position`, auto-named to the next free `T<n>`. */
  static addTransition(net: PetriNet, position: Vec2): PetriNet {
    const transition: Transition = {
      id: newId(),
      name: NetOps._freeName(net, "transition"),
      position,
    };
    return { ...net, transitions: [...net.transitions, transition] };
  }

  // --- copy / paste ---------------------------------------------------------

  /**
   * The sub-net induced by `nodeIds`: those places/transitions plus every arc whose **both**
   * endpoints are in the set (an arc with only one endpoint inside is dropped). Deep-cloned, so the
   * result is self-contained — a clipboard snapshot that survives later edits to the source net.
   */
  static inducedSubgraph(net: PetriNet, nodeIds: string[]): PetriNet {
    const ids = new Set(nodeIds);
    return structuredClone({
      places: net.places.filter((p) => ids.has(p.id)),
      transitions: net.transitions.filter((t) => ids.has(t.id)),
      arcs: net.arcs.filter((a) => ids.has(a.source) && ids.has(a.target)),
    });
  }

  /**
   * Paste `clip` into `net`, translated by `offset`. Each node gets a fresh id and the next free
   * sequential name (allocated against the growing net so a multi-node paste can't self-collide);
   * node positions and arc polylines shift by `offset`; arc endpoints remap to the new node ids.
   * Tokens, rotation, magnetic flags, multiplicity, label offsets, and unknown `_extra` carry
   * verbatim. Returns the new net and the inserted ids so the caller can select the paste.
   */
  static paste(net: PetriNet, clip: PetriNet, offset: Vec2): PasteResult {
    const idMap = new Map<string, string>();
    const nodeIds: string[] = [];
    let places = net.places;
    let transitions = net.transitions;

    for (const p of clip.places) {
      const id = newId();
      idMap.set(p.id, id);
      const name = NetOps._freeName({ places, transitions, arcs: net.arcs }, "place");
      places = [...places, { ...p, id, name, position: NetOps._shift(p.position, offset) }];
      nodeIds.push(id);
    }
    for (const t of clip.transitions) {
      const id = newId();
      idMap.set(t.id, id);
      const name = NetOps._freeName({ places, transitions, arcs: net.arcs }, "transition");
      transitions = [
        ...transitions,
        { ...t, id, name, position: NetOps._shift(t.position, offset) },
      ];
      nodeIds.push(id);
    }

    const arcIds: string[] = [];
    const pasted: Arc[] = [];
    for (const a of clip.arcs) {
      const source = idMap.get(a.source);
      const target = idMap.get(a.target);
      if (source === undefined || target === undefined) continue; // induced subgraph keeps both
      const id = newId();
      pasted.push({
        ...a,
        id,
        source,
        target,
        points: a.points.map((pt) => NetOps._shift(pt, offset)),
      });
      arcIds.push(id);
    }

    return { net: { places, transitions, arcs: [...net.arcs, ...pasted] }, nodeIds, arcIds };
  }

  // --- move (drag commit) ---------------------------------------------------

  /**
   * Move a node to `position`, translating each attached **magnetic** arc endpoint by the
   * same delta so it keeps its stored border offset. Free endpoints and interior waypoints
   * stay put. Returns the net unchanged if the node is unknown or did not move.
   */
  static moveNode(net: PetriNet, id: string, position: Vec2): PetriNet {
    const node = net.places.find((p) => p.id === id) ?? net.transitions.find((t) => t.id === id);
    if (!node) return net;
    const dx = position.x - node.position.x;
    const dy = position.y - node.position.y;
    if (dx === 0 && dy === 0) return net;

    const move = <T extends Place | Transition>(n: T): T => (n.id === id ? { ...n, position } : n);
    const arcs = net.arcs.map((arc) => {
      const moveSrc = arc.source === id && arc.srcMagnetic;
      const moveDst = arc.target === id && arc.destMagnetic;
      if (!moveSrc && !moveDst) return arc;
      const last = arc.points.length - 1;
      const points = arc.points.map((pt, i) =>
        (moveSrc && i === 0) || (moveDst && i === last) ? { x: pt.x + dx, y: pt.y + dy } : pt,
      );
      return { ...arc, points };
    });
    return {
      places: net.places.map(move),
      transitions: net.transitions.map(move),
      arcs,
    };
  }

  /**
   * Move several nodes at once (a marquee group-drag), each translating its own magnetic arc
   * endpoints. Applied sequentially, so an arc whose endpoints are both in the group has each
   * end translated by its own node's delta. Interior waypoints stay put (Phase 1). One transform,
   * so the store commits it as a single undo entry.
   */
  static moveNodes(net: PetriNet, moves: { id: string; position: Vec2 }[]): PetriNet {
    return moves.reduce((acc, m) => NetOps.moveNode(acc, m.id, m.position), net);
  }

  // --- rotate ---------------------------------------------------------------

  /**
   * Set a transition's rotation (degrees, normalized to [0, 360); 0 drops the `gui`).
   * Each attached **magnetic** endpoint is rotated about the node center by the same delta
   * so it keeps its border offset on the rotated bar (the magnetic model — never re-clipped
   * toward the line). Free endpoints and waypoints stay put. No-op if unknown or unchanged.
   */
  static rotateTransition(net: PetriNet, id: string, deg: number): PetriNet {
    const t = net.transitions.find((tr) => tr.id === id);
    if (!t) return net;
    const next = ((deg % 360) + 360) % 360;
    const prev = t.gui?.rotation ?? 0;
    if (next === prev) return net;

    const theta = ((next - prev) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const c = t.position;
    const rotate = (p: Vec2): Vec2 => {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      return { x: c.x + (cos * dx - sin * dy), y: c.y + (sin * dx + cos * dy) };
    };
    const transitions = net.transitions.map((tr) =>
      tr.id === id ? { ...tr, gui: next === 0 ? undefined : { rotation: next } } : tr,
    );
    const arcs = net.arcs.map((arc) => {
      const rotSrc = arc.source === id && arc.srcMagnetic;
      const rotDst = arc.target === id && arc.destMagnetic;
      if (!rotSrc && !rotDst) return arc;
      const last = arc.points.length - 1;
      const points = arc.points.map((p, i) =>
        (rotSrc && i === 0) || (rotDst && i === last) ? rotate(p) : p,
      );
      return { ...arc, points };
    });
    return { places: net.places, transitions, arcs };
  }

  // --- connect --------------------------------------------------------------

  /** True iff an arc `source`→`target` is allowed: bipartite and not already present. */
  static canConnect(net: PetriNet, source: string, target: string): boolean {
    if (source === target) return false;
    const s = NetOps._kind(net, source);
    const t = NetOps._kind(net, target);
    if (s === undefined || t === undefined || s === t) return false;
    return !net.arcs.some((a) => a.source === source && a.target === target);
  }

  /**
   * Connect `source`→`target`, magnetic at both ends and weight 1, with the given interior
   * `bends` (flow-space, in order). Each endpoint is clipped to its node border toward its
   * neighbour — the first bend (or the target centre when straight) for the source, the last
   * bend (or the source centre) for the target. No-op if {@link NetOps.canConnect} is false.
   */
  static connect(net: PetriNet, source: string, target: string, bends: Vec2[] = []): PetriNet {
    if (!NetOps.canConnect(net, source, target)) return net;
    const sCenter = NetOps._center(net, source);
    const tCenter = NetOps._center(net, target);
    if (!sCenter || !tCenter) return net;
    const arc: Arc = {
      id: newId(),
      source,
      target,
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        NetOps.borderPoint(net, source, bends[0] ?? tCenter),
        ...bends,
        NetOps.borderPoint(net, target, bends[bends.length - 1] ?? sCenter),
      ],
    };
    return { ...net, arcs: [...net.arcs, arc] };
  }

  /**
   * The id of the node whose body contains `point` (flow-space), or `null`. Used by the
   * click-to-draw layer to resolve a bend-vs-finish click and to flag a hover target.
   * Transitions are tested before places; `pad` widens every hit-box for a forgiving target.
   */
  static nodeAt(net: PetriNet, point: Vec2, pad = 0): string | null {
    for (const t of net.transitions) {
      if (NodeGeometry.transitionContains(t.position, t.gui?.rotation ?? 0, point, pad))
        return t.id;
    }
    for (const p of net.places) {
      if (NodeGeometry.placeContains(p.position, point, pad)) return p.id;
    }
    return null;
  }

  // --- edit properties ------------------------------------------------------

  /**
   * True iff a node of `kind` other than `exceptId` already carries exactly `name`
   * (case-sensitive; places and transitions namespace separately). The UI uses this to block
   * a duplicate rename — {@link NetOps.rename} itself stays total and never rejects.
   */
  static isNameTaken(net: PetriNet, kind: NodeKind, name: string, exceptId?: string): boolean {
    const nodes = kind === "place" ? net.places : net.transitions;
    return nodes.some((n) => n.id !== exceptId && n.name === name);
  }

  /** Rename the place or transition with this id. */
  static rename(net: PetriNet, id: string, name: string): PetriNet {
    return {
      ...net,
      places: net.places.map((p) => (p.id === id ? { ...p, name } : p)),
      transitions: net.transitions.map((t) => (t.id === id ? { ...t, name } : t)),
    };
  }

  /** Set a place's M0 token count (clamped to a non-negative integer). */
  static setTokens(net: PetriNet, placeId: string, tokens: number): PetriNet {
    const value = Math.max(0, Math.round(tokens));
    return {
      ...net,
      places: net.places.map((p) => (p.id === placeId ? { ...p, tokens: value } : p)),
    };
  }

  /** Set an arc's weight (clamped to an integer ≥ 1). */
  static setMultiplicity(net: PetriNet, arcId: string, multiplicity: number): PetriNet {
    const value = Math.max(1, Math.round(multiplicity));
    return {
      ...net,
      arcs: net.arcs.map((a) => (a.id === arcId ? { ...a, multiplicity: value } : a)),
    };
  }

  // --- arc geometry (waypoint / endpoint editing) ---------------------------

  /** Move an interior waypoint (index `1..last-1`) to `position`. No-op if not interior. */
  static moveWaypoint(net: PetriNet, arcId: string, index: number, position: Vec2): PetriNet {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc || index <= 0 || index >= arc.points.length - 1) return net;
    const cur = arc.points[index];
    if (cur.x === position.x && cur.y === position.y) return net;
    return NetOps._withPoints(
      net,
      arcId,
      arc.points.map((p, i) => (i === index ? position : p)),
    );
  }

  /** Insert a new waypoint at `index` (`1..last`, i.e. on an interior segment boundary). */
  static insertWaypoint(net: PetriNet, arcId: string, index: number, position: Vec2): PetriNet {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc || index <= 0 || index > arc.points.length - 1) return net;
    return NetOps._withPoints(net, arcId, [
      ...arc.points.slice(0, index),
      position,
      ...arc.points.slice(index),
    ]);
  }

  /** Remove the interior waypoint at `index` (`1..last-1`). No-op for an endpoint. */
  static removeWaypoint(net: PetriNet, arcId: string, index: number): PetriNet {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc || index <= 0 || index >= arc.points.length - 1) return net;
    return NetOps._withPoints(
      net,
      arcId,
      arc.points.filter((_, i) => i !== index),
    );
  }

  /**
   * Where an endpoint lands when dragged toward `target`: clipped to the node border when
   * that end is **magnetic**, else `target` verbatim (a free endpoint). Pure — shared by the
   * live drag preview and {@link NetOps.moveEndpoint} so both agree pixel-for-pixel.
   */
  static endpointDrop(net: PetriNet, arcId: string, end: ArcEnd, target: Vec2): Vec2 {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc) return target;
    const magnetic = end === "src" ? arc.srcMagnetic : arc.destMagnetic;
    if (!magnetic) return target;
    return NetOps.borderPoint(net, end === "src" ? arc.source : arc.target, target);
  }

  /** Move an arc endpoint toward `target` (re-clipped to the border when magnetic). */
  static moveEndpoint(net: PetriNet, arcId: string, end: ArcEnd, target: Vec2): PetriNet {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc) return net;
    const index = end === "src" ? 0 : arc.points.length - 1;
    const drop = NetOps.endpointDrop(net, arcId, end, target);
    const cur = arc.points[index];
    if (cur.x === drop.x && cur.y === drop.y) return net;
    return NetOps._withPoints(
      net,
      arcId,
      arc.points.map((p, i) => (i === index ? drop : p)),
    );
  }

  // --- remove ---------------------------------------------------------------

  /** Remove an arc by id, or a node by id together with its incident arcs. No-op if unknown. */
  static remove(net: PetriNet, id: string): PetriNet {
    if (net.arcs.some((a) => a.id === id)) {
      return { ...net, arcs: net.arcs.filter((a) => a.id !== id) };
    }
    return {
      places: net.places.filter((p) => p.id !== id),
      transitions: net.transitions.filter((t) => t.id !== id),
      arcs: net.arcs.filter((a) => a.source !== id && a.target !== id),
    };
  }

  // --- internals ------------------------------------------------------------

  /** Translate a point by `offset` (returns a fresh Vec2). */
  private static _shift(p: Vec2, offset: Vec2): Vec2 {
    return { x: p.x + offset.x, y: p.y + offset.y };
  }

  /** The lowest `P<n>`/`T<n>` (n ≥ 1) not currently in use for `kind`, filling gaps left by deletes. */
  private static _freeName(net: PetriNet, kind: NodeKind): string {
    const prefix = kind === "place" ? "P" : "T";
    let n = 1;
    while (NetOps.isNameTaken(net, kind, `${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  }

  /** Return a new net with arc `arcId`'s polyline replaced by `points`. */
  private static _withPoints(net: PetriNet, arcId: string, points: Vec2[]): PetriNet {
    return { ...net, arcs: net.arcs.map((a) => (a.id === arcId ? { ...a, points } : a)) };
  }

  private static _kind(net: PetriNet, id: string): NodeKind | undefined {
    if (net.places.some((p) => p.id === id)) return "place";
    if (net.transitions.some((t) => t.id === id)) return "transition";
    return undefined;
  }

  private static _center(net: PetriNet, id: string): Vec2 | undefined {
    return (net.places.find((p) => p.id === id) ?? net.transitions.find((t) => t.id === id))
      ?.position;
  }

  /**
   * Centers of every node (places then transitions), optionally excluding one id — the set a
   * placing ghost or a dragged node aligns its center against.
   */
  static nodeCenters(net: PetriNet, exceptId?: string): Vec2[] {
    const centers: Vec2[] = [];
    for (const p of net.places) if (p.id !== exceptId) centers.push(p.position);
    for (const t of net.transitions) if (t.id !== exceptId) centers.push(t.position);
    return centers;
  }

  /** Border point of node `id` along the direction from its center toward `toward`. */
  static borderPoint(net: PetriNet, id: string, toward: Vec2): Vec2 {
    const place = net.places.find((p) => p.id === id);
    if (place) return NodeGeometry.placeBorderPoint(place.position, toward);
    const transition = net.transitions.find((t) => t.id === id);
    if (transition) {
      return NodeGeometry.transitionBorderPoint(
        transition.position,
        transition.gui?.rotation ?? 0,
        toward,
      );
    }
    return toward;
  }
}
