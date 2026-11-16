import { describe, expect, it } from "vitest";
import { StateTableFormat } from "@/domain/analysis/stateTableFormat";
import type { StateTable } from "@/domain/analysis/types";
import type { PetriNet } from "@/domain/types";

const net: PetriNet = {
  places: [
    { id: "p1", name: "Idle", tokens: 1, position: { x: 0, y: 0 } },
    { id: "p2", name: "Busy", tokens: 0, position: { x: 0, y: 0 } },
  ],
  transitions: [{ id: "t1", name: "Start", position: { x: 0, y: 0 } }],
  arcs: [],
};

describe("StateTableFormat", () => {
  it("writes every row as tab-separated text with names", () => {
    const table: StateTable = {
      placeIds: ["p1", "p2"],
      complete: true,
      rows: [
        {
          name: "M0",
          tokens: [1, 0],
          firings: [{ transition: "t1", to: 1 }],
          deadlock: false,
          explored: true,
        },
        { name: "M1", tokens: [0, 1], firings: [], deadlock: true, explored: true },
        { name: "M2", tokens: [5, 5], firings: [], deadlock: false, explored: false },
      ],
    };
    expect(StateTableFormat.toText(table, net)).toBe(
      "Marking\tIdle\tBusy\tFirings\tDeadlock\nM0\t1\t0\tStart to M1\t\nM1\t0\t1\t\tyes\nM2\t5\t5\tnot explored\t",
    );
  });

  it("cleans quotes, tabs and newlines in names", () => {
    const odd: PetriNet = {
      ...net,
      places: [{ id: "p1", name: '"A"\tB\nC', tokens: 0, position: { x: 0, y: 0 } }],
    };
    const table: StateTable = { placeIds: ["p1"], complete: true, rows: [] };
    expect(StateTableFormat.toText(table, odd).split("\n")[0]).toBe(
      "Marking\t'A' B C\tFirings\tDeadlock",
    );
  });
});
