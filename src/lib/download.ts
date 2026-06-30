import { NpnCodec } from "@/codec/npn";
import { PnmlCodec } from "@/codec/pnml";
import type { PetriNet } from "@/domain/types";
import { NetSvg } from "@/flow/svgExport";

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

/**
 * Browser-side image export of a {@link PetriNet}. {@link NetSvg} owns the (pure, tested) SVG bytes;
 * this owns the Blob/anchor/canvas mechanics. SVG is a direct download; PNG is rasterized from that
 * same SVG via an offscreen canvas — no extra dependency, and the self-contained SVG (vector shapes
 * and text, no external refs) keeps the canvas untainted so `toBlob` succeeds.
 */
export class ImageFile {
  /** PNG raster scale — 2× keeps lines and labels crisp on hi-dpi screens and in print. */
  static readonly PNG_SCALE = 2;

  /** Download `net` as an `.svg` vector image. */
  static saveSvg(net: PetriNet, filename = "net.svg"): void {
    const blob = new Blob([NetSvg.serialize(net)], { type: "image/svg+xml;charset=utf-8" });
    ImageFile._download(URL.createObjectURL(blob), ImageFile._ext(filename, "svg"));
  }

  /** Rasterize `net` to a `.png` (2× scale) and download it. Asynchronous: the image must decode first. */
  static savePng(net: PetriNet, filename = "net.png"): void {
    const blob = new Blob([NetSvg.serialize(net)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = (): void => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * ImageFile.PNG_SCALE));
      canvas.height = Math.max(1, Math.round(h * ImageFile.PNG_SCALE));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ImageFile.PNG_SCALE, ImageFile.PNG_SCALE);
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (png) ImageFile._download(URL.createObjectURL(png), ImageFile._ext(filename, "png"));
      }, "image/png");
    };
    img.onerror = (): void => URL.revokeObjectURL(url);
    img.src = url;
  }

  private static _download(url: string, filename: string): void {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private static _ext(filename: string, ext: string): string {
    return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  }
}

/**
 * Browser-side PNML interop: a download of the net serialized to ISO/IEC 15909-2 PNML, and an
 * `<input type="file">` open that parses `.pnml`/`.xml`. {@link PnmlCodec} owns the bytes; this owns
 * the Blob/anchor/picker mechanics, mirroring {@link NpnFile}.
 */
export class PnmlFile {
  /** Download `net` serialized to PNML. */
  static save(net: PetriNet, filename = "net.pnml"): void {
    const blob = new Blob([PnmlCodec.serialize(net)], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename.endsWith(".pnml") ? filename : `${filename}.pnml`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
