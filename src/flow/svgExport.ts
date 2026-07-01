import { NodeGeometry } from "@/domain/nodeGeometry";
import type { Arc, PetriNet, Place, Transition, Vec2 } from "@/domain/types";
import { ArcGeometry } from "@/flow/edges/arcGeometry";
import { PlaceTokens } from "@/flow/nodes/tokens";

// Colours mirror the on-screen canvas (FlowProjection.ARC_COLOR, the node components, token dots).
const ARC_COLOR = "#334155"; // slate-700 — arc stroke + arrowhead
const NODE_STROKE = "#334155"; // slate-700 — place border + transition fill
const TOKEN_FILL = "#0f172a"; // slate-900 — token dots / count numeral
const LABEL_FILL = "#334155"; // slate-700 — element name labels
const WEIGHT_BORDER = "#cbd5e1"; // slate-300 — arc weight chip border
const FONT = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const PADDING = 24; // margin around the net's bounding box
// Rough per-character width and line height at 12px, used only to keep name labels inside the bbox.
const LABEL_CHAR_W = 6.6;
const LABEL_HEIGHT = 14;
// Default name-label offset below a node (matches the components: half-extent + 10px).
const PLACE_LABEL_DY = NodeGeometry.PLACE_RADIUS + 10;
const TRANSITION_LABEL_DY = NodeGeometry.TRANSITION_BOX / 2 + 10;
const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** A growing axis-aligned bounding box; `addBox` expands by a w×h rectangle centered at (cx, cy). */
class BBox {
  minX = Number.POSITIVE_INFINITY;
  minY = Number.POSITIVE_INFINITY;
  maxX = Number.NEGATIVE_INFINITY;
  maxY = Number.NEGATIVE_INFINITY;

  get empty(): boolean {
    return this.minX === Number.POSITIVE_INFINITY;
  }
  get width(): number {
    return this.maxX - this.minX;
  }
  get height(): number {
    return this.maxY - this.minY;
  }

  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }

  addBox(cx: number, cy: number, w: number, h: number): void {
    this.add(cx - w / 2, cy - h / 2);
    this.add(cx + w / 2, cy + h / 2);
  }
}

/**
 * Renders a {@link PetriNet} to a standalone SVG document, matching the canvas look (place circles
 * with token dots/numerals, transition bars, weighted arrows with rounded bends, name labels). Pure
 * and framework-free — no DOM — so it is unit-testable; the browser download glue lives in
 * `ImageFile` (lib/download). Geometry is shared with the live view (NodeGeometry, ArcGeometry,
 * PlaceTokens) so an export is faithful to what the user sees.
 */
export class NetSvg {
  static readonly TOKEN_DOT = 7; // dot diameter (matches the 7px on-screen dots)
  static readonly TOKEN_GAP = 4; // gap between dots (Tailwind gap-1)

  static serialize(net: PetriNet): string {
    const bbox = new BBox();
    const body: string[] = [];

    // Arcs first so the nodes draw on top, exactly as the canvas layers them.
    for (const arc of net.arcs) {
      if (arc.points.length < 2) continue; // a dangling arc has no drawable polyline
      body.push(NetSvg._arc(arc));
      for (const p of arc.points) bbox.add(p.x, p.y);
      if (arc.multiplicity > 1) {
        const m = ArcGeometry.midpoint(arc.points);
        bbox.addBox(m.x, m.y, 24, 16);
      }
    }
    for (const place of net.places) {
      body.push(NetSvg._place(place));
      bbox.addBox(
        place.position.x,
        place.position.y,
        NodeGeometry.PLACE_DIAMETER,
        NodeGeometry.PLACE_DIAMETER,
      );
      NetSvg._addLabelBox(bbox, place.name, place.position, place.labelPosition, PLACE_LABEL_DY);
    }
    for (const transition of net.transitions) {
      body.push(NetSvg._transition(transition));
      // A rotated bar's farthest reach is its half-diagonal; bound by a square of that diameter.
      const reach = Math.hypot(
        NodeGeometry.TRANSITION_BAR_WIDTH,
        NodeGeometry.TRANSITION_BAR_HEIGHT,
      );
      bbox.addBox(transition.position.x, transition.position.y, reach, reach);
      NetSvg._addLabelBox(
        bbox,
        transition.name,
        transition.position,
        transition.labelPosition,
        TRANSITION_LABEL_DY,
      );
    }

    if (bbox.empty) return NetSvg._document(0, 0, 100, 100, "");
    const x = bbox.minX - PADDING;
    const y = bbox.minY - PADDING;
    return NetSvg._document(
      x,
      y,
      bbox.width + 2 * PADDING,
      bbox.height + 2 * PADDING,
      body.join(""),
    );
  }

  private static _document(x: number, y: number, w: number, h: number, body: string): string {
    const rx = NetSvg._r(x);
    const ry = NetSvg._r(y);
    const rw = NetSvg._r(w);
    const rh = NetSvg._r(h);
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${rw}" height="${rh}" ` +
      `viewBox="${rx} ${ry} ${rw} ${rh}" font-family="${FONT}">` +
      `<defs><marker id="arc-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="12" ` +
      `markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">` +
      `<path d="M0,0 L10,5 L0,10 z" fill="${ARC_COLOR}"/></marker></defs>` +
      `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="#ffffff"/>` +
      `${body}</svg>`
    );
  }

  private static _arc(arc: Arc): string {
    const line = `<path d="${ArcGeometry.roundedPath(arc.points)}" fill="none" stroke="${ARC_COLOR}" stroke-width="1.5" marker-end="url(#arc-arrow)"/>`;
    if (arc.multiplicity <= 1) return line;
    const m = ArcGeometry.midpoint(arc.points);
    const text = String(arc.multiplicity);
    const bw = text.length * 8 + 6;
    const box = `<rect x="${NetSvg._r(m.x - bw / 2)}" y="${NetSvg._r(m.y - 8)}" width="${NetSvg._r(bw)}" height="16" rx="2" fill="#ffffff" stroke="${WEIGHT_BORDER}"/>`;
    const label = `<text x="${NetSvg._r(m.x)}" y="${NetSvg._r(m.y)}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="600" fill="${LABEL_FILL}">${text}</text>`;
    return line + box + label;
  }

  private static _place(place: Place): string {
    const c = place.position;
    const circle = `<circle cx="${NetSvg._r(c.x)}" cy="${NetSvg._r(c.y)}" r="${NodeGeometry.PLACE_RADIUS}" fill="#ffffff" stroke="${NODE_STROKE}" stroke-width="2"/>`;
    return (
      circle +
      NetSvg._tokens(c, place.tokens) +
      NetSvg._label(place.name, c, place.labelPosition, PLACE_LABEL_DY)
    );
  }

  private static _transition(t: Transition): string {
    const c = t.position;
    const w = NodeGeometry.TRANSITION_BAR_WIDTH;
    const h = NodeGeometry.TRANSITION_BAR_HEIGHT;
    const rot = t.gui?.rotation ?? 0;
    const transform = rot
      ? ` transform="rotate(${NetSvg._r(rot)} ${NetSvg._r(c.x)} ${NetSvg._r(c.y)})"`
      : "";
    const rect = `<rect x="${NetSvg._r(c.x - w / 2)}" y="${NetSvg._r(c.y - h / 2)}" width="${w}" height="${h}" fill="${NODE_STROKE}"${transform}/>`;
    return rect + NetSvg._label(t.name, c, t.labelPosition, TRANSITION_LABEL_DY);
  }

  /** Token presentation: nothing, a small dot cluster (1–4), or a numeral (5+) — like the place node. */
  private static _tokens(center: Vec2, tokens: number): string {
    const display = PlaceTokens.display(tokens);
    if (display.kind === "empty") return "";
    if (display.kind === "number") {
      return `<text x="${NetSvg._r(center.x)}" y="${NetSvg._r(center.y)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="${TOKEN_FILL}">${display.value}</text>`;
    }
    const n = display.count;
    const cols = Math.min(n, 2);
    const rows = Math.ceil(n / cols);
    const pitch = NetSvg.TOKEN_DOT + NetSvg.TOKEN_GAP;
    const gridW = cols * NetSvg.TOKEN_DOT + (cols - 1) * NetSvg.TOKEN_GAP;
    const gridH = rows * NetSvg.TOKEN_DOT + (rows - 1) * NetSvg.TOKEN_GAP;
    const left = center.x - gridW / 2 + NetSvg.TOKEN_DOT / 2;
    const top = center.y - gridH / 2 + NetSvg.TOKEN_DOT / 2;
    const dots: string[] = [];
    for (let i = 0; i < n; i++) {
      const cx = left + (i % cols) * pitch;
      const cy = top + Math.floor(i / cols) * pitch;
      dots.push(
        `<circle cx="${NetSvg._r(cx)}" cy="${NetSvg._r(cy)}" r="${NetSvg.TOKEN_DOT / 2}" fill="${TOKEN_FILL}"/>`,
      );
    }
    return dots.join("");
  }

  private static _label(
    name: string,
    center: Vec2,
    labelPosition: Vec2 | undefined,
    defaultDy: number,
  ): string {
    if (!name) return "";
    const x = center.x + (labelPosition?.x ?? 0);
    const y = center.y + (labelPosition?.y ?? defaultDy);
    return `<text x="${NetSvg._r(x)}" y="${NetSvg._r(y)}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="${LABEL_FILL}">${NetSvg._esc(name)}</text>`;
  }

  private static _addLabelBox(
    bbox: BBox,
    name: string,
    center: Vec2,
    labelPosition: Vec2 | undefined,
    defaultDy: number,
  ): void {
    if (!name) return;
    const x = center.x + (labelPosition?.x ?? 0);
    const y = center.y + (labelPosition?.y ?? defaultDy);
    bbox.addBox(x, y, name.length * LABEL_CHAR_W, LABEL_HEIGHT);
  }

  /** Round to 2 decimals so the SVG stays compact without visible drift. */
  private static _r(n: number): number {
    return Math.round(n * 100) / 100;
  }

  /** Escape XML-significant characters in element names so any label survives serialization. */
  private static _esc(s: string): string {
    return s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
  }
}
