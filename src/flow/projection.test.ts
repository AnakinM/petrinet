import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NpnCodec } from "@/codec/npn";
import { FlowProjection } from "@/flow/projection";
import { SAMPLE_NET } from "@/flow/sampleNet";

// The reference sample is gitignored (kept local); tests needing it skip when absent.
const FIXTURE = new URL("../../export-12.npn", import.meta.url);
const hasFixture = existsSync(FIXTURE);
const fixtureText = (): string => new TextDecoder().decode(readFileSync(FIXTURE));

describe("FlowProjection.toNodes", () => {
  it("creates one node per place and transition", () => {
    const nodes = FlowProjection.toNodes(SAMPLE_NET);
    expect(nodes).toHaveLength(SAMPLE_NET.places.length + SAMPLE_NET.transitions.length);
  });

  it("tags each node with its domain type and id", () => {
    const nodes = FlowProjection.toNodes(SAMPLE_NET);
    expect(nodes.find((n) => n.id === "p-ready")?.type).toBe("place");
    expect(nodes.find((n) => n.id === "t-finish")?.type).toBe("transition");
  });

  it("clones positions rather than sharing the domain Vec2 reference", () => {
    const nodes = FlowProjection.toNodes(SAMPLE_NET);
    const node = nodes.find((n) => n.id === "p-ready");
    expect(node?.position).toEqual(SAMPLE_NET.places[0].position);
    expect(node?.position).not.toBe(SAMPLE_NET.places[0].position);
  });

  it("carries the source domain object in node data", () => {
    const node = FlowProjection.toNodes(SAMPLE_NET).find((n) => n.id === "t-finish");
    if (node?.type === "transition") {
      expect(node.data.transition.gui?.rotation).toBe(90);
    } else {
      expect.fail("expected a transition node");
    }
  });

  describe.skipIf(!hasFixture)("against the local export-12.npn", () => {
    it("projects every element to a node (45 places + 65 transitions)", () => {
      const nodes = FlowProjection.toNodes(NpnCodec.parse(fixtureText()));
      expect(nodes).toHaveLength(110);
      expect(nodes.filter((n) => n.type === "place")).toHaveLength(45);
      expect(nodes.filter((n) => n.type === "transition")).toHaveLength(65);
    });

    it("gives every node a finite position", () => {
      for (const node of FlowProjection.toNodes(NpnCodec.parse(fixtureText()))) {
        expect(Number.isFinite(node.position.x) && Number.isFinite(node.position.y)).toBe(true);
      }
    });
  });
});

describe("FlowProjection.toEdges", () => {
  it("creates one edge per arc", () => {
    const edges = FlowProjection.toEdges(SAMPLE_NET);
    expect(edges).toHaveLength(SAMPLE_NET.arcs.length);
  });

  it("wires each edge to its arc's endpoints and the custom arc type", () => {
    const edge = FlowProjection.toEdges(SAMPLE_NET).find((e) => e.id === "a-ready-start");
    expect(edge?.type).toBe("arc");
    expect(edge?.source).toBe("p-ready");
    expect(edge?.target).toBe("t-start");
  });

  it("carries the source arc in edge data", () => {
    const edge = FlowProjection.toEdges(SAMPLE_NET).find((e) => e.id === "a-buffer-finish");
    expect(edge?.data?.arc.multiplicity).toBe(2);
  });

  it("attaches a closed arrowhead marker at the target end", () => {
    const edge = FlowProjection.toEdges(SAMPLE_NET)[0];
    expect(edge.markerEnd).toMatchObject({ type: "arrowclosed" });
  });

  describe.skipIf(!hasFixture)("against the local export-12.npn", () => {
    it("projects every arc to an edge (170 arcs)", () => {
      expect(FlowProjection.toEdges(NpnCodec.parse(fixtureText()))).toHaveLength(170);
    });
  });
});
