import { PetriNetEngine } from "@/domain/engine";
import { NetOps } from "@/domain/netOps";
import type { PetriNet, Vec2 } from "@/domain/types";

/** A place spec for {@link GuideNets.build}: id, label, optional initial tokens, and center. */
interface PlaceSpec {
  id: string;
  name: string;
  tokens?: number;
  at: Vec2;
}

/** A transition spec: id, label, and center. */
interface TransitionSpec {
  id: string;
  name: string;
  at: Vec2;
}

/** An arc spec: source and target ids, optional interior bends, and optional weight (default 1). */
interface ArcSpec {
  from: string;
  to: string;
  bends?: Vec2[];
  weight?: number;
}

/**
 * Builders for the small example nets drawn in the `/guide` page. Each returns a real
 * {@link PetriNet}, so the guide renders them through the same {@link NetSvg} exporter the app
 * uses for image export. Arc endpoints are clipped to the node borders by {@link NetOps.connect},
 * so a guide diagram looks exactly like a net drawn on the canvas.
 */
export class GuideNets {
  /** Assemble a net from plain specs, clipping every arc to its node borders. */
  private static build(
    places: PlaceSpec[],
    transitions: TransitionSpec[],
    arcs: ArcSpec[],
  ): PetriNet {
    let net: PetriNet = {
      places: places.map((p) => ({
        id: p.id,
        name: p.name,
        tokens: p.tokens ?? 0,
        position: p.at,
      })),
      transitions: transitions.map((t) => ({ id: t.id, name: t.name, position: t.at })),
      arcs: [],
    };
    for (const a of arcs) {
      const before = net.arcs.length;
      net = NetOps.connect(net, a.from, a.to, a.bends ?? []);
      if (net.arcs.length > before && a.weight && a.weight > 1) {
        net = NetOps.setMultiplicity(net, net.arcs[net.arcs.length - 1].id, a.weight);
      }
    }
    return net;
  }

  /** Return a copy of `net` with the marking advanced by firing `transitionId` once. */
  static fire(net: PetriNet, transitionId: string): PetriNet {
    const engine = new PetriNetEngine(net);
    const next = engine.fire(transitionId, PetriNetEngine.initialMarking(net));
    return { ...net, places: net.places.map((p) => ({ ...p, tokens: next[p.id] ?? p.tokens })) };
  }

  /** Place, transition, place in a row: the three building blocks with two tokens waiting in P1. */
  static anatomy(): PetriNet {
    return GuideNets.build(
      [
        { id: "p1", name: "P1", tokens: 2, at: { x: 0, y: 0 } },
        { id: "p2", name: "P2", at: { x: 180, y: 0 } },
      ],
      [{ id: "t1", name: "T1", at: { x: 90, y: 0 } }],
      [
        { from: "p1", to: "t1" },
        { from: "t1", to: "p2" },
      ],
    );
  }

  /** Two places holding 3 and 6 tokens: shows the dot cluster and the numeral used for larger counts. */
  static tokenCounts(): PetriNet {
    return GuideNets.build(
      [
        { id: "a", name: "3 tokens", tokens: 3, at: { x: 0, y: 0 } },
        { id: "b", name: "6 tokens", tokens: 6, at: { x: 130, y: 0 } },
      ],
      [],
      [],
    );
  }

  /** The firing example before T1 fires: one token in P1, none in P2, T1 enabled. */
  static firingBefore(): PetriNet {
    return GuideNets.build(
      [
        { id: "p1", name: "P1", tokens: 1, at: { x: 0, y: 0 } },
        { id: "p2", name: "P2", at: { x: 180, y: 0 } },
      ],
      [{ id: "t1", name: "T1", at: { x: 90, y: 0 } }],
      [
        { from: "p1", to: "t1" },
        { from: "t1", to: "p2" },
      ],
    );
  }

  /** The same net after T1 fires: the token has moved from P1 to P2. */
  static firingAfter(): PetriNet {
    return GuideNets.fire(GuideNets.firingBefore(), "t1");
  }

  /** A weighted input arc: T1 needs two tokens from P1 to fire, and produces one in P2. */
  static weighted(): PetriNet {
    return GuideNets.build(
      [
        { id: "p1", name: "P1", tokens: 3, at: { x: 0, y: 0 } },
        { id: "p2", name: "P2", at: { x: 180, y: 0 } },
      ],
      [{ id: "t1", name: "T1", at: { x: 90, y: 0 } }],
      [
        { from: "p1", to: "t1", weight: 2 },
        { from: "t1", to: "p2" },
      ],
    );
  }

  /**
   * A traffic light as a single token cycling through Red, Green, and Yellow. The return arc from
   * Stop back to Red is routed above the net with two bends so it reads cleanly.
   */
  static trafficLight(): PetriNet {
    return GuideNets.build(
      [
        { id: "red", name: "Red", tokens: 1, at: { x: 0, y: 0 } },
        { id: "green", name: "Green", at: { x: 0, y: 180 } },
        { id: "yellow", name: "Yellow", at: { x: 240, y: 180 } },
      ],
      [
        { id: "go", name: "Go", at: { x: 0, y: 90 } },
        { id: "caution", name: "Caution", at: { x: 120, y: 180 } },
        { id: "stop", name: "Stop", at: { x: 240, y: 90 } },
      ],
      [
        { from: "red", to: "go" },
        { from: "go", to: "green" },
        { from: "green", to: "caution" },
        { from: "caution", to: "yellow" },
        { from: "yellow", to: "stop" },
        {
          from: "stop",
          to: "red",
          bends: [
            { x: 240, y: -70 },
            { x: 0, y: -70 },
          ],
        },
      ],
    );
  }

  /**
   * Fork and join: Split turns one token into two parallel tasks, and Join waits for both before
   * continuing. The classic picture of concurrency and synchronization in a Petri net.
   */
  static forkJoin(): PetriNet {
    return GuideNets.build(
      [
        { id: "start", name: "Start", tokens: 1, at: { x: 0, y: 60 } },
        { id: "taskA", name: "Task A", at: { x: 190, y: 0 } },
        { id: "taskB", name: "Task B", at: { x: 190, y: 120 } },
        { id: "done", name: "Done", at: { x: 380, y: 60 } },
      ],
      [
        { id: "split", name: "Split", at: { x: 90, y: 60 } },
        { id: "join", name: "Join", at: { x: 290, y: 60 } },
      ],
      [
        { from: "start", to: "split" },
        { from: "split", to: "taskA" },
        { from: "split", to: "taskB" },
        { from: "taskA", to: "join" },
        { from: "taskB", to: "join" },
        { from: "join", to: "done" },
      ],
    );
  }
}
