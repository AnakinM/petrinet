/** How a place's token count is presented inside its circle. */
export type TokenDisplay =
  | { kind: "empty" }
  | { kind: "dots"; count: number }
  | { kind: "number"; value: number };

/** Decides whether a place shows discrete token dots or a numeral. */
export class PlaceTokens {
  /** At most this many tokens render as dots; above it, the count shows as a number. */
  static readonly MAX_DOTS = 4;

  static display(tokens: number): TokenDisplay {
    if (tokens <= 0) return { kind: "empty" };
    if (tokens <= PlaceTokens.MAX_DOTS) return { kind: "dots", count: tokens };
    return { kind: "number", value: tokens };
  }
}
