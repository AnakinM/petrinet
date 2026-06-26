import type { Marking, Place } from "@/domain/types";

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
}
