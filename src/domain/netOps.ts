import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";
import { newId } from "@/lib/id";

/** Which side of an arc an endpoint sits on. */
export type ArcEnd = "src" | "dest";

type NodeKind = "place" | "transition";

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

  /** Append a new place (0 tokens) centered at `position`. */
  static addPlace(net: PetriNet, position: Vec2): PetriNet {
    const place: Place = { id: newId(), name: `P${net.places.length + 1}`, tokens: 0, position };
    return { ...net, places: [...net.places, place] };
  }

  /** Append a new (unrotated) transition centered at `position`. */
  static addTransition(net: PetriNet, position: Vec2): PetriNet {
    const transition: Transition = {
      id: newId(),
      name: `T${net.transitions.length + 1}`,
      position,
    };
    return { ...net, transitions: [...net.transitions, transition] };
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
   * Connect `source`→`target` with a straight 2-point arc, magnetic at both ends and weight
   * 1, the endpoints clipped to the node borders. No-op if {@link NetOps.canConnect} is false.
   */
  static connect(net: PetriNet, source: string, target: string): PetriNet {
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
      points: [NetOps._border(net, source, tCenter), NetOps._border(net, target, sCenter)],
    };
    return { ...net, arcs: [...net.arcs, arc] };
  }

  // --- edit properties ------------------------------------------------------

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

  /**
   * Flip one endpoint of an arc between magnetic and free. Turning an endpoint magnetic
   * re-clips it to the node border (toward the adjacent point); turning it free leaves it
   * at its current absolute position.
   */
  static toggleEndpointMagnetic(net: PetriNet, arcId: string, end: ArcEnd): PetriNet {
    const arc = net.arcs.find((a) => a.id === arcId);
    if (!arc) return net;
    const isSrc = end === "src";
    const nowMagnetic = !(isSrc ? arc.srcMagnetic : arc.destMagnetic);
    let points = arc.points;
    if (nowMagnetic) {
      const last = arc.points.length - 1;
      const idx = isSrc ? 0 : last;
      const toward = arc.points[isSrc ? 1 : last - 1];
      const nodeId = isSrc ? arc.source : arc.target;
      const clipped = NetOps._border(net, nodeId, toward);
      points = arc.points.map((pt, i) => (i === idx ? clipped : pt));
    }
    const next: Arc = {
      ...arc,
      srcMagnetic: isSrc ? nowMagnetic : arc.srcMagnetic,
      destMagnetic: isSrc ? arc.destMagnetic : nowMagnetic,
      points,
    };
    return { ...net, arcs: net.arcs.map((a) => (a.id === arcId ? next : a)) };
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
    return NetOps._border(net, end === "src" ? arc.source : arc.target, target);
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

  /** Border point of node `id` along the direction from its center toward `toward`. */
  private static _border(net: PetriNet, id: string, toward: Vec2): Vec2 {
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
