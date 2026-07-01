import { type JSX, useMemo } from "react";
import type { PetriNet } from "@/domain/types";
import { NetSvg } from "@/flow/svgExport";

/**
 * Turn a net into an inline, responsive SVG string. {@link NetSvg.serialize} produces a standalone
 * SVG document; here the XML prolog is dropped and the fixed pixel width/height are removed so the
 * diagram scales to its container while the `viewBox` keeps its aspect ratio.
 */
function inlineSvg(net: PetriNet): string {
  return NetSvg.serialize(net)
    .replace(/^<\?xml[^>]*\?>\s*/, "")
    .replace(/(<svg\b[^>]*?)\s+width="[\d.]+"\s+height="[\d.]+"/, "$1");
}

/**
 * A figure that renders a {@link PetriNet} exactly as the editor's image export would, with an
 * optional caption. Used throughout the guide so every diagram is a real net drawn by the tool.
 */
export function GuideDiagram({
  net,
  caption,
  className,
}: {
  net: PetriNet;
  caption?: string;
  className?: string;
}): JSX.Element {
  const svg = useMemo(() => inlineSvg(net), [net]);
  return (
    <figure className={`flex flex-col items-center ${className ?? ""}`}>
      <div
        className="w-full [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:w-full"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the markup comes from our own NetSvg serializer applied to static example nets, never user input.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {caption && (
        <figcaption className="mt-3 text-center text-slate-500 text-sm">{caption}</figcaption>
      )}
    </figure>
  );
}
