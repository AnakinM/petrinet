// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PetriNet } from "@/domain/types";
import { useNetStore } from "@/store/netStore";
import { PropertiesPanel } from "@/ui/PropertiesPanel";

const ORIGIN = { x: 0, y: 0 };

// Places Buffer/Queue and transitions Emit/Drain — names are unique within each kind.
const NET: PetriNet = {
  places: [
    { id: "p1", name: "Buffer", tokens: 0, position: ORIGIN },
    { id: "p2", name: "Queue", tokens: 0, position: ORIGIN },
  ],
  transitions: [
    { id: "t1", name: "Emit", position: ORIGIN },
    { id: "t2", name: "Drain", position: ORIGIN },
  ],
  arcs: [],
};

function show(id: string): void {
  useNetStore.getState().select({ nodes: [id], edges: [] });
  render(<PropertiesPanel />);
}

async function commitName(from: string, to: string): Promise<void> {
  const input = screen.getByDisplayValue(from);
  await userEvent.clear(input);
  await userEvent.type(input, to);
  await userEvent.tab(); // blur → commit
}

describe("PropertiesPanel name uniqueness", () => {
  beforeEach(() => {
    useNetStore.getState().setNet(NET);
  });
  afterEach(cleanup);

  it("rejects renaming a place to a name another place holds", async () => {
    show("p1");
    await commitName("Buffer", "Queue");
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(useNetStore.getState().net.places.find((p) => p.id === "p1")?.name).toBe("Buffer");
  });

  it("commits a rename to a free name", async () => {
    show("p1");
    await commitName("Buffer", "Sink");
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(useNetStore.getState().net.places.find((p) => p.id === "p1")?.name).toBe("Sink");
  });

  it("allows a place to take a name only a transition holds (separate namespaces)", async () => {
    show("p1");
    await commitName("Buffer", "Emit");
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
    expect(useNetStore.getState().net.places.find((p) => p.id === "p1")?.name).toBe("Emit");
  });

  it("rejects renaming a transition to a name another transition holds", async () => {
    show("t2");
    await commitName("Drain", "Emit");
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(useNetStore.getState().net.transitions.find((t) => t.id === "t2")?.name).toBe("Drain");
  });
});
