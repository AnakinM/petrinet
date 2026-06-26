import { beforeEach, describe, expect, it } from "vitest";
import { useBuildStore } from "@/store/buildStore";

describe("buildStore arc draft", () => {
  beforeEach(() => {
    useBuildStore.getState().cancelArc();
  });

  it("starts a draft from a source node with no bends", () => {
    useBuildStore.getState().startArc("p1", { x: 5, y: 5 });
    expect(useBuildStore.getState().draft).toEqual({
      source: "p1",
      bends: [],
      cursor: { x: 5, y: 5 },
      hoverTarget: null,
    });
  });

  it("tracks the live cursor and the hover target", () => {
    useBuildStore.getState().startArc("p1", { x: 0, y: 0 });
    useBuildStore.getState().moveDraft({ x: 9, y: 9 }, "t1");
    expect(useBuildStore.getState().draft).toMatchObject({
      cursor: { x: 9, y: 9 },
      hoverTarget: "t1",
    });
  });

  it("appends bends in order and advances the cursor to each", () => {
    useBuildStore.getState().startArc("p1", { x: 0, y: 0 });
    useBuildStore.getState().addBend({ x: 10, y: 0 });
    useBuildStore.getState().addBend({ x: 10, y: 10 });
    expect(useBuildStore.getState().draft?.bends).toEqual([
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(useBuildStore.getState().draft?.cursor).toEqual({ x: 10, y: 10 });
  });

  it("cancel clears the draft", () => {
    useBuildStore.getState().startArc("p1", { x: 0, y: 0 });
    useBuildStore.getState().cancelArc();
    expect(useBuildStore.getState().draft).toBeNull();
  });

  it("move and addBend are no-ops with no active draft", () => {
    useBuildStore.getState().moveDraft({ x: 1, y: 1 }, null);
    useBuildStore.getState().addBend({ x: 1, y: 1 });
    expect(useBuildStore.getState().draft).toBeNull();
  });
});

describe("buildStore tool mode", () => {
  beforeEach(() => {
    useBuildStore.getState().setTool("idle");
  });

  it("defaults to the idle tool", () => {
    expect(useBuildStore.getState().tool).toBe("idle");
  });

  it("setTool activates the given tool", () => {
    useBuildStore.getState().setTool("place");
    expect(useBuildStore.getState().tool).toBe("place");
  });

  it("toggleTool activates from idle, then deactivates the active tool", () => {
    useBuildStore.getState().toggleTool("transition");
    expect(useBuildStore.getState().tool).toBe("transition");
    useBuildStore.getState().toggleTool("transition");
    expect(useBuildStore.getState().tool).toBe("idle");
  });

  it("toggleTool switches directly between tools", () => {
    useBuildStore.getState().toggleTool("place");
    useBuildStore.getState().toggleTool("transition");
    expect(useBuildStore.getState().tool).toBe("transition");
  });

  it("activating a tool cancels an in-progress arc draft (the two are exclusive)", () => {
    useBuildStore.getState().startArc("p1", { x: 0, y: 0 });
    useBuildStore.getState().toggleTool("place");
    expect(useBuildStore.getState().draft).toBeNull();
    expect(useBuildStore.getState().tool).toBe("place");
  });
});
