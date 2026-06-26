import type { Marking, PetriNet, Place } from "@/domain/types";

/**
 * Resolving a place/transition **id** to its display **name** — the one place that mapping lives,
 * shared by the analytics facade (witness strings) and the analytics tabs (rendered labels). Pure
 * and framework-free. Ids are the stable key; a missing id falls back to itself.
 */
export class NetNames {
  /** A Map-backed `id → name` resolver over the given elements — build once, call many times. */
  static resolver(nodes: { id: string; name: string }[]): (id: string) => string {
    const names = new Map(nodes.map((n) => [n.id, n.name] as const));
    return (id) => names.get(id) ?? id;
  }

  /** A marking as `P1=0, P2=1` over place names, in net order — the one deadlock-marking format. */
  static formatMarking(marking: Marking, places: Place[]): string {
    return places.map((p) => `${p.name}=${marking[p.id] ?? 0}`).join(", ");
  }

  /** Only the marked places (token count > 0) as `P3=1` strings, in net order — the dead-marking bullets. */
  static markedPlaces(marking: Marking, places: Place[]): string[] {
    return places.filter((p) => (marking[p.id] ?? 0) > 0).map((p) => `${p.name}=${marking[p.id]}`);
  }

  /**
   * A fired transition as `T1: P1 → P2` — its name, then its input place names, an arrow, its
   * output place names (each side joined with ` + `, in arc order; an empty side shown as `∅` for a
   * source/sink transition). The one history-row firing descriptor.
   */
  static describeFiring(net: PetriNet, transitionId: string): string {
    const name = NetNames.resolver(net.transitions)(transitionId);
    const placeName = NetNames.resolver(net.places);
    const inputs = net.arcs
      .filter((a) => a.target === transitionId)
      .map((a) => placeName(a.source));
    const outputs = net.arcs
      .filter((a) => a.source === transitionId)
      .map((a) => placeName(a.target));
    const side = (names: string[]): string => (names.length > 0 ? names.join(" + ") : "∅");
    return `${name}: ${side(inputs)} → ${side(outputs)}`;
  }
}
