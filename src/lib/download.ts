import { NpnCodec } from "@/codec/npn";
import { PnmlCodec, PnmlParseError, type PnmlRefusalReason } from "@/codec/pnml";
import { TIKZ_FILE_NAME, TikzCodec } from "@/codec/tikz";
import type { PetriNet } from "@/domain/types";
import { NetSvg } from "@/flow/svgExport";

/**
 * Browser-side download of a {@link PetriNet} as a byte-faithful `.npn` file (UTF-8 BOM, no trailing
 * newline). The codec owns the bytes; this owns the Blob/anchor mechanics. Opening any supported net
 * file lives on {@link NetFile}, which auto-detects the format.
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
}

/** A net file format that the editor reads: the native `.npn` or PNML. */
export type NetFormat = "npn" | "pnml";

/**
 * A net file that its codec refused. `format` names the codec that was chosen for it. `reason` is
 * the PNML refusal reason; an `.npn` failure is always "invalid".
 */
export class NetImportError extends Error {
  readonly format: NetFormat;
  readonly reason: PnmlRefusalReason;

  constructor(format: NetFormat, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "NetImportError";
    this.format = format;
    this.reason = cause instanceof PnmlParseError ? cause.reason : "invalid";
  }
}

/**
 * Opens any supported net file through one picker, auto-detecting the format: native `.npn` (JSON) or
 * `.pnml` / `.xml` (PNML). The codec selection (by extension, falling back to a leading `<` for
 * XML) stays here so the UI just asks for "a net". A parse error rejects with a
 * {@link NetImportError}, so the caller can surface it and knows which format was refused.
 */
export class NetFile {
  /** Open the file picker for `.npn`/`.pnml` and resolve with the parsed net, its format and filename. */
  static open(): Promise<{ name: string; format: NetFormat; net: PetriNet }> {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".npn,.pnml,.xml,application/json,application/xml";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        file
          .text()
          .then((text) => {
            const format = NetFile._format(file.name, text);
            resolve({ name: file.name, format, net: NetFile._parse(format, text) });
          })
          .catch(reject);
      });
      input.click();
    });
  }

  /** Choose the format by extension, falling back to a leading `<` (XML) for an unknown extension. */
  private static _format(name: string, text: string): NetFormat {
    const lower = name.toLowerCase();
    const isPnml =
      lower.endsWith(".pnml") || lower.endsWith(".xml") || text.trimStart().startsWith("<");
    return isPnml ? "pnml" : "npn";
  }

  private static _parse(format: NetFormat, text: string): PetriNet {
    try {
      return format === "pnml" ? PnmlCodec.parse(text) : NpnCodec.parse(text);
    } catch (error) {
      throw new NetImportError(format, error);
    }
  }
}

/**
 * Browser-side picture export of a {@link PetriNet}. {@link NetSvg} and {@link TikzCodec} own the
 * (pure, tested) bytes; this owns the Blob/anchor/canvas/clipboard mechanics. SVG and TikZ are
 * direct downloads. PNG is rasterized from that same SVG via an offscreen canvas, with no extra
 * dependency, and the clipboard copy uses that same PNG. The self-contained SVG (vector shapes and
 * text, no external refs) keeps the canvas untainted so `toBlob` succeeds.
 */
export class ImageFile {
  /** PNG raster scale: 2× keeps lines and labels crisp on hi-dpi screens and in print. */
  static readonly PNG_SCALE = 2;

  /** Download `net` as an `.svg` vector image. */
  static saveSvg(net: PetriNet, filename = "net.svg"): void {
    const blob = new Blob([NetSvg.serialize(net)], { type: "image/svg+xml;charset=utf-8" });
    ImageFile._download(URL.createObjectURL(blob), ImageFile._ext(filename, "svg"));
  }

  /** Download `net` as a LaTeX TikZ picture. */
  static saveTikz(net: PetriNet, filename = TIKZ_FILE_NAME): void {
    const blob = new Blob([TikzCodec.serialize(net)], { type: "text/x-tex;charset=utf-8" });
    ImageFile._download(URL.createObjectURL(blob), ImageFile._ext(filename, "tex"));
  }

  /** Rasterize `net` to a `.png` (2× scale) and download it. Asynchronous: the image must decode first. */
  static savePng(net: PetriNet, filename = "net.png"): void {
    ImageFile._rasterize(net).then(
      (png) => ImageFile._download(URL.createObjectURL(png), ImageFile._ext(filename, "png")),
      // A picture that cannot be drawn downloads nothing, as before.
      () => {},
    );
  }

  /** True when this browser can put a picture on the clipboard (not in an insecure page or an old browser). */
  static canCopy(): boolean {
    return typeof ClipboardItem === "function" && typeof navigator.clipboard?.write === "function";
  }

  /**
   * Copy `net` to the clipboard as the same PNG picture that {@link savePng} downloads. Call it
   * directly in the click handler: Safari allows the write only when the `ClipboardItem` is made
   * during the click, so the item holds a promise for the PNG that is still being drawn.
   */
  static copyPng(net: PetriNet): Promise<void> {
    const item = new ClipboardItem({ "image/png": ImageFile._rasterize(net) });
    return navigator.clipboard.write([item]);
  }

  /** Draw the SVG picture of `net` on a canvas at {@link PNG_SCALE} and encode it as PNG. */
  private static _rasterize(net: PetriNet): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([NetSvg.serialize(net)], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const failed = (): void => reject(new Error("The picture could not be drawn."));
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
        canvas.toBlob((png) => (png ? resolve(png) : failed()), "image/png");
      };
      img.onerror = (): void => {
        URL.revokeObjectURL(url);
        failed();
      };
      img.src = url;
    });
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
