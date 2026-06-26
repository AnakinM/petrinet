import { NpnCodec } from "@/codec/npn";
import type { PetriNet } from "@/domain/types";

/**
 * The browser-side boundary between a {@link PetriNet} and an `.npn` file: a
 * BOM-prefixed, byte-faithful download and an `<input type="file">` open/parse.
 *
 * Cohesive home for the file <-> net round-trip in the DOM; the codec owns the
 * bytes, this owns the Blob/anchor/picker mechanics. {@link NpnFile.open} rejects
 * with {@link NpnParseError} on malformed input so the caller surfaces a clear error.
 */
export class NpnFile {
  /** Trigger a download of `net` serialized to `.npn` (UTF-8 BOM, no trailing newline). */
  static save(net: PetriNet, filename = "net.npn"): void {
    const blob = new Blob([NpnCodec.BOM + NpnCodec.serialize(net)], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".npn") ? filename : `${filename}.npn`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Open the file picker and resolve with the parsed net and chosen filename.
   * The promise stays pending if the user cancels (no `change` fires); it rejects
   * if the chosen file is not valid `.npn`.
   */
  static open(): Promise<{ name: string; net: PetriNet }> {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".npn,application/json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        file
          .text()
          .then((text) => resolve({ name: file.name, net: NpnCodec.parse(text) }))
          .catch(reject);
      });
      input.click();
    });
  }
}
