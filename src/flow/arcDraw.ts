import { NetOps } from "@/domain/netOps";
import type { PetriNet, Vec2 } from "@/domain/types";
import { type ArcDraft, useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";

/**
 * What a tap resolves to during an in-progress arc draw: finish on a valid target, drop an
 * interior bend on empty canvas, or ignore (the source itself, or a target that would break the
 * bipartite rule). Shared by the desktop capture overlay ({@link ArcDrawLayer}) and the touch tap
 * routing in the {@link Canvas}, so the finish / bend policy lives in exactly one place.
 */
export type ArcTap =
  | { kind: "connect"; target: string }
  | { kind: "bend"; at: Vec2 }
  | { kind: "ignore" };

export class ArcDraw {
  /** Resolve a tap at flow-point `at`, over node `hit` (or `null` on empty canvas), for `draft`. */
  static resolveTap(net: PetriNet, draft: ArcDraft, at: Vec2, hit: string | null): ArcTap {
    if (hit === null) return { kind: "bend", at };
    if (hit !== draft.source && NetOps.canConnect(net, draft.source, hit)) {
      return { kind: "connect", target: hit };
    }
    return { kind: "ignore" };
  }

  /** Apply a resolved tap: finish creates the arc and ends the draw; bend extends the polyline. */
  static applyTap(tap: ArcTap, draft: ArcDraft): void {
    if (tap.kind === "connect") {
      useNetStore.getState().connect(draft.source, tap.target, draft.bends);
      useBuildStore.getState().cancelArc();
    } else if (tap.kind === "bend") {
      useBuildStore.getState().addBend(tap.at);
    }
  }
}
