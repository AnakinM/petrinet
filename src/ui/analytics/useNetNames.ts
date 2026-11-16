import { useMemo } from "react";
import { NetNames } from "@/domain/netNames";
import type { PetriNet } from "@/domain/types";
import { useNetStore } from "@/store/netStore";

/** The current net with its id-to-name resolvers, rebuilt only when the net changes. */
export interface NetNaming {
  net: PetriNet;
  placeName: (id: string) => string;
  transitionName: (id: string) => string;
  /** The name of a place or a transition. */
  nodeName: (id: string) => string;
  /** Whether a node id belongs to a place or to a transition. */
  kindOf: (id: string) => "place" | "transition";
}

/** The live net and its name resolvers, shared by every tab of the Analysis panel. */
export function useNetNames(): NetNaming {
  const net = useNetStore((s) => s.net);
  return useMemo(() => {
    const placeIds = new Set(net.places.map((p) => p.id));
    return {
      net,
      placeName: NetNames.resolver(net.places),
      transitionName: NetNames.resolver(net.transitions),
      nodeName: NetNames.resolver([...net.places, ...net.transitions]),
      kindOf: (id) => (placeIds.has(id) ? "place" : "transition"),
    };
  }, [net]);
}
