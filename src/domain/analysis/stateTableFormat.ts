import { TsvCell } from "@/domain/analysis/tsvCell";
import type { StateTable } from "@/domain/analysis/types";
import { NetNames } from "@/domain/netNames";
import type { PetriNet } from "@/domain/types";

/** The state table as text for pasting. Pure and framework-free. */
export class StateTableFormat {
  /**
   * Tab-separated, every row. Columns: Marking, one per place (token counts), Firings
   * ("T1 to M3; T2 to M4", or "not explored" for a row the search never finished), Deadlock ("yes" or empty). A header row comes first.
   */
  static toText(table: StateTable, net: PetriNet): string {
    const placeName = NetNames.resolver(net.places);
    const transitionName = NetNames.resolver(net.transitions);
    const clean = TsvCell.clean;
    const header = [
      "Marking",
      ...table.placeIds.map((id) => clean(placeName(id))),
      "Firings",
      "Deadlock",
    ];
    const rows = table.rows.map((row) => [
      row.name,
      ...row.tokens.map(String),
      row.explored
        ? row.firings
            .map((f) => `${clean(transitionName(f.transition))} to ${table.rows[f.to].name}`)
            .join("; ")
        : "not explored",
      row.deadlock ? "yes" : "",
    ]);
    return [header, ...rows].map((cells) => cells.join("\t")).join("\n");
  }
}
