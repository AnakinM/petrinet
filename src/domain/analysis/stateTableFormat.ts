import type { StateTable } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { PetriNet } from "@/domain/types";

/** The state table as text for pasting. Pure and framework-free. */
export class StateTableFormat {
  /**
   * Tab-separated, every row. Columns: Marking, one per place (token counts), Firings
   * ("T1 to M3; T2 to M4"), Deadlock ("yes" or empty). A header row comes first.
   */
  static toText(table: StateTable, net: PetriNet): string {
    const placeName = NetNames.resolver(net.places);
    const transitionName = NetNames.resolver(net.transitions);
    const clean = (name: string): string => name.replace(/[\t\r\n]+/g, " ");
    const header = [
      "Marking",
      ...table.placeIds.map((id) => clean(placeName(id))),
      "Firings",
      "Deadlock",
    ];
    const rows = table.rows.map((row) => [
      row.name,
      ...row.tokens.map(String),
      row.firings.map((f) => `${clean(transitionName(f.transition))} to ${f.to}`).join("; "),
      row.deadlock ? "yes" : "",
    ]);
    return [header, ...rows].map((cells) => cells.join("\t")).join("\n");
  }
}
