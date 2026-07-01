import { describe, expect, it } from "vitest";
import { PetriNetEngine } from "@/domain/engine";
import { GuideNets } from "@/guide/exampleNets";

describe("GuideNets example nets", () => {
  it("wires the anatomy net with clipped arc endpoints", () => {
    const net = GuideNets.anatomy();
    expect(net.places).toHaveLength(2);
    expect(net.transitions).toHaveLength(1);
    expect(net.arcs).toHaveLength(2);
    expect(net.places.find((p) => p.id === "p1")?.tokens).toBe(2);
    // connect() clips endpoints to the node borders, so every arc has a real two-point polyline.
    expect(net.arcs.every((a) => a.points.length >= 2)).toBe(true);
  });

  it("moves the token from P1 to P2 when T1 fires", () => {
    const before = GuideNets.firingBefore();
    expect(before.places.find((p) => p.id === "p1")?.tokens).toBe(1);
    expect(before.places.find((p) => p.id === "p2")?.tokens).toBe(0);

    const after = GuideNets.firingAfter();
    expect(after.places.find((p) => p.id === "p1")?.tokens).toBe(0);
    expect(after.places.find((p) => p.id === "p2")?.tokens).toBe(1);
  });

  it("sets a weight of two on the weighted input arc", () => {
    const net = GuideNets.weighted();
    const input = net.arcs.find((a) => a.source === "p1" && a.target === "t1");
    expect(input?.multiplicity).toBe(2);
  });

  it("builds the traffic light as a single-token cycle", () => {
    const net = GuideNets.trafficLight();
    expect(net.places).toHaveLength(3);
    expect(net.transitions).toHaveLength(3);
    expect(net.arcs).toHaveLength(6);
    const total = net.places.reduce((sum, p) => sum + p.tokens, 0);
    expect(total).toBe(1);
  });

  it("forks one token into two parallel tasks that Join then synchronises", () => {
    const net = GuideNets.forkJoin();
    const engine = new PetriNetEngine(net);
    const m0 = PetriNetEngine.initialMarking(net);
    // Only Split is enabled at the start; Join waits for both tasks.
    expect(engine.enabledTransitions(m0)).toEqual(["split"]);

    const afterSplit = engine.fire("split", m0);
    expect(afterSplit.taskA).toBe(1);
    expect(afterSplit.taskB).toBe(1);
    expect(engine.enabledTransitions(afterSplit)).toContain("join");
  });
});
