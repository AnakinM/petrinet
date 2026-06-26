/** Fresh element ids. The `.npn` format uses UUIDs, so new places/transitions/arcs match. */
export function newId(): string {
  return crypto.randomUUID();
}
