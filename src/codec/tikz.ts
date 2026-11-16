import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { PlaceTokens } from "@/flow/nodes/tokens";
import { NetSvg } from "@/flow/svgExport";

/** Default name of the downloaded TikZ file. */
export const TIKZ_FILE_NAME = "net.tex";

const LATEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "^": "\\textasciicircum{}",
  _: "\\_",
  "%": "\\%",
  "~": "\\textasciitilde{}",
};

const STYLES = [
  "netplace/.style={draw=black!75, fill=white, line width=1pt}",
  "nettransition/.style={draw=black!75, fill=black!75}",
  "netarc/.style={draw=black!75, line width=0.75pt, rounded corners=6pt, -{Stealth[length=2.5mm]}}",
  "nettoken/.style={fill=black!90, draw=none}",
  "netlabel/.style={font=\\small, text=black!75}",
  "netweight/.style={fill=white, draw=black!20, inner sep=1.5pt, font=\\scriptsize\\bfseries}",
];

/**
 * Exports a {@link PetriNet} as a TikZ (LaTeX) snippet that mirrors the canvas picture: same
 * geometry as the SVG export (node sizes, token dots, label offsets), arcs drawn through their
 * explicit `points`, no node anchors. Pure and framework-free; the download glue lives elsewhere.
 * Export only.
 */
export class TikzCodec {
  /** Centimetres per canvas pixel: a 40 px place becomes a 1 cm circle. */
  static readonly CM_PER_PX = 0.025;

  static serialize(net: PetriNet): string {
    const body: string[] = [];
    for (const arc of net.arcs) {
      if (arc.points.length >= 2) body.push(...TikzCodec._arc(arc));
    }
    for (const place of net.places) body.push(...TikzCodec._place(place));
    for (const transition of net.transitions) body.push(...TikzCodec._transition(transition));

    return [
      "% Petri net exported from PetriNet Editor.",
      "% Add these lines to the preamble of your document:",
      "%   \\usepackage{tikz}",
      "%   \\usetikzlibrary{petri,arrows.meta}",
      "% Cyrillic and other non-Latin names need a suitable font setup (or xelatex / lualatex).",
      `\\begin{tikzpicture}[${STYLES.join(",\n  ")}]`,
      ...body.map((line) => `  ${line}`),
      "\\end{tikzpicture}",
      "",
    ].join("\n");
  }

  private static _arc(arc: Arc): string[] {
    const path = arc.points.map((p) => TikzCodec._pt(p)).join(" -- ");
    const lines = [`\\draw[netarc] ${path};`];
    if (arc.multiplicity > 1) {
      lines.push(
        `\\node[netweight] at ${TikzCodec._pt(ArcGeometry.midpoint(arc.points))} {${arc.multiplicity}};`,
      );
    }
    return lines;
  }

  private static _place(place: Place): string[] {
    const c = place.position;
    const r = TikzCodec._n(NodeGeometry.PLACE_RADIUS * TikzCodec.CM_PER_PX);
    const lines = [`\\draw[netplace] ${TikzCodec._pt(c)} circle (${r});`];
    lines.push(...TikzCodec._tokens(c, place.tokens));
    lines.push(
      ...TikzCodec._label(place.name, c, place.labelPosition, NodeGeometry.PLACE_RADIUS + 10),
    );
    return lines;
  }

  private static _transition(t: Transition): string[] {
    const c = t.position;
    const hw = NodeGeometry.TRANSITION_BAR_WIDTH / 2;
    const hh = NodeGeometry.TRANSITION_BAR_HEIGHT / 2;
    const corner1 = TikzCodec._pt({ x: c.x - hw, y: c.y - hh });
    const corner2 = TikzCodec._pt({ x: c.x + hw, y: c.y + hh });
    const rot = t.gui?.rotation ?? 0;
    // Screen rotation is clockwise; with the y flip TikZ needs the negated angle.
    const rotate = rot ? `, rotate around={${TikzCodec._n(-rot)}:${TikzCodec._pt(c)}}` : "";
    return [
      `\\draw[nettransition${rotate}] ${corner1} rectangle ${corner2};`,
      ...TikzCodec._label(t.name, c, t.labelPosition, NodeGeometry.TRANSITION_BOX / 2 + 10),
    ];
  }

  /** Nothing, a dot grid (1 to MAX_DOTS, same layout as the SVG), or a numeral above that. */
  private static _tokens(center: Vec2, tokens: number): string[] {
    const display = PlaceTokens.display(tokens);
    if (display.kind === "empty") return [];
    if (display.kind === "number") {
      return [
        `\\node[font=\\normalsize\\bfseries] at ${TikzCodec._pt(center)} {${display.value}};`,
      ];
    }
    const n = display.count;
    const cols = Math.min(n, 2);
    const rows = Math.ceil(n / cols);
    const dot = NetSvg.TOKEN_DOT;
    const pitch = dot + NetSvg.TOKEN_GAP;
    const gridW = cols * dot + (cols - 1) * NetSvg.TOKEN_GAP;
    const gridH = rows * dot + (rows - 1) * NetSvg.TOKEN_GAP;
    const left = center.x - gridW / 2 + dot / 2;
    const top = center.y - gridH / 2 + dot / 2;
    const r = TikzCodec._n((dot / 2) * TikzCodec.CM_PER_PX);
    const lines: string[] = [];
    for (let i = 0; i < n; i++) {
      const p = { x: left + (i % cols) * pitch, y: top + Math.floor(i / cols) * pitch };
      lines.push(`\\fill[nettoken] ${TikzCodec._pt(p)} circle (${r});`);
    }
    return lines;
  }

  private static _label(
    name: string,
    center: Vec2,
    labelPosition: Vec2 | undefined,
    defaultDy: number,
  ): string[] {
    if (!name) return [];
    const at = {
      x: center.x + (labelPosition?.x ?? 0),
      y: center.y + (labelPosition?.y ?? defaultDy),
    };
    return [`\\node[netlabel] at ${TikzCodec._pt(at)} {${TikzCodec._escape(name)}};`];
  }

  /** A canvas point as a TikZ coordinate in centimetres, with the y axis flipped. */
  private static _pt(p: Vec2): string {
    return `(${TikzCodec._n(p.x * TikzCodec.CM_PER_PX)},${TikzCodec._n(-p.y * TikzCodec.CM_PER_PX)})`;
  }

  /** Round to 2 decimals; never prints "-0". */
  private static _n(n: number): string {
    const r = Math.round(n * 100) / 100;
    return String(r === 0 ? 0 : r);
  }

  private static _escape(s: string): string {
    return s.replace(/\r?\n/g, " ").replace(/[\\{}$&#^_%~]/g, (c) => LATEX_ESCAPES[c]);
  }
}
