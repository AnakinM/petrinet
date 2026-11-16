import { describe, expect, it } from "vitest";

import { TIKZ_FILE_NAME, TikzCodec } from "@/codec/tikz";
import type { Arc, PetriNet } from "@/domain/types";
import { SAMPLE_NET } from "@/flow/sampleNet";

function arc(over: Partial<Arc> = {}): Arc {
  return {
    id: "a",
    source: "p",
    target: "t",
    srcMagnetic: true,
    destMagnetic: true,
    multiplicity: 1,
    points: [
      { x: 20, y: 0 },
      { x: 100, y: 40 },
    ],
    ...over,
  };
}

function net(over: Partial<PetriNet> = {}): PetriNet {
  return {
    places: [{ id: "p", name: "p1", tokens: 0, position: { x: 0, y: 0 } }],
    transitions: [{ id: "t", name: "t1", position: { x: 120, y: 40 } }],
    arcs: [arc()],
    ...over,
  };
}

describe("TikzCodec", () => {
  it("names the file net.tex", () => {
    expect(TIKZ_FILE_NAME).toBe("net.tex");
  });

  it("writes the expected snippet for a small net", () => {
    expect(TikzCodec.serialize(net())).toBe(
      [
        "% Petri net exported from PetriNet Editor.",
        "% Add these lines to the preamble of your document:",
        "%   \\usepackage[T1]{fontenc}",
        "%   \\usepackage{tikz}",
        "%   \\usetikzlibrary{petri,arrows.meta}",
        "% Cyrillic and other non-Latin names need a suitable font setup (or xelatex / lualatex).",
        "\\begin{tikzpicture}[netplace/.style={draw=black!75, fill=white, line width=0.05cm},",
        "  nettransition/.style={fill=black!75},",
        "  netarc/.style={draw=black!75, line width=0.04cm, rounded corners=0.2cm, -{Stealth[length=0.3cm]}},",
        "  nettoken/.style={fill=black!90},",
        "  netlabel/.style={font=\\small, text=black!75},",
        "  netweight/.style={fill=white, draw=black!20, inner sep=1.5pt, font=\\scriptsize\\bfseries}]",
        "  \\draw[netarc] (0.5,0) -- (2.5,-1);",
        "  \\draw[netplace] (0,0) circle (0.5);",
        "  \\node[netlabel] at (0,-0.75) {p1};",
        "  \\fill[nettransition] (2.81,-0.5) rectangle (3.19,-1.5);",
        "  \\node[netlabel] at (3,-1.75) {t1};",
        "\\end{tikzpicture}",
        "",
      ].join("\n"),
    );
  });

  it("flips the y axis and scales pixels to centimetres", () => {
    const out = TikzCodec.serialize(
      net({
        arcs: [
          arc({
            points: [
              { x: 40, y: 80 },
              { x: 40, y: -80 },
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("\\draw[netarc] (1,-2) -- (1,2);");
  });

  it("never prints a negative zero", () => {
    const out = TikzCodec.serialize(
      net({
        arcs: [
          arc({
            points: [
              { x: 0, y: 0 },
              { x: -0.001, y: 0.001 },
            ],
          }),
        ],
      }),
    );
    expect(out).toContain("(0,0) -- (0,0)");
    expect(out).not.toContain("-0,");
    expect(out).not.toContain("-0)");
  });

  it("draws dots up to MAX_DOTS and a numeral above", () => {
    const withTokens = (tokens: number): string =>
      TikzCodec.serialize(
        net({ places: [{ id: "p", name: "", tokens, position: { x: 0, y: 0 } }], arcs: [] }),
      );
    expect(withTokens(0)).not.toContain("nettoken]");
    expect(withTokens(1).match(/\\fill\[nettoken\]/g)).toHaveLength(1);
    expect(withTokens(4).match(/\\fill\[nettoken\]/g)).toHaveLength(4);
    expect(withTokens(4)).not.toContain("\\normalsize");
    const five = withTokens(5);
    expect(five).not.toContain("\\fill[nettoken]");
    expect(five).toContain("\\node[font=\\normalsize\\bfseries] at (0,0) {5};");
  });

  it("lays three dots out in the same grid as the SVG", () => {
    const out = TikzCodec.serialize(
      net({ places: [{ id: "p", name: "", tokens: 3, position: { x: 0, y: 0 } }], arcs: [] }),
    );
    expect(out).toContain("\\fill[nettoken] (-0.14,0.14) circle (0.09);");
    expect(out).toContain("\\fill[nettoken] (0.14,0.14) circle (0.09);");
    expect(out).toContain("\\fill[nettoken] (-0.14,-0.14) circle (0.09);");
  });

  it("puts a weight chip on arcs above 1 only", () => {
    expect(TikzCodec.serialize(net())).not.toContain("\\node[netweight]");
    const out = TikzCodec.serialize(net({ arcs: [arc({ multiplicity: 3 })] }));
    expect(out).toContain("\\node[netweight] at (1.5,-0.5) {3};");
  });

  it("rotates a transition about its centre, negating the angle for the y flip", () => {
    const out = TikzCodec.serialize(
      net({
        transitions: [{ id: "t", name: "", position: { x: 40, y: 0 }, gui: { rotation: 30 } }],
        arcs: [],
      }),
    );
    expect(out).toContain("\\fill[nettransition, rotate around={-30:(1,0)}]");
    expect(TikzCodec.serialize(net())).not.toContain("rotate around");
  });

  it("keeps label positions as offsets from the node centre", () => {
    const out = TikzCodec.serialize(
      net({
        places: [
          {
            id: "p",
            name: "x",
            tokens: 0,
            position: { x: 0, y: 0 },
            labelPosition: { x: 40, y: -40 },
          },
        ],
        arcs: [],
      }),
    );
    expect(out).toContain("\\node[netlabel] at (1,1) {x};");
  });

  it("escapes LaTeX special characters and keeps UTF-8 letters", () => {
    const out = TikzCodec.serialize(
      net({
        places: [{ id: "p", name: "a_b %{x}\\$&#^~", tokens: 0, position: { x: 0, y: 0 } }],
        transitions: [{ id: "t", name: "Zażółć Москва", position: { x: 0, y: 80 } }],
        arcs: [],
      }),
    );
    expect(out).toContain(
      "{a\\_b \\%\\{x\\}\\textbackslash{}\\$\\&\\#\\textasciicircum{}\\textasciitilde{}}",
    );
    expect(out).toContain("{Zażółć Москва}");
  });

  it("escapes characters that OT1 would print wrongly and dash ligatures", () => {
    const out = TikzCodec.serialize(
      net({
        places: [{ id: "p", name: "a<b>|c--d", tokens: 0, position: { x: 0, y: 0 } }],
        arcs: [],
      }),
    );
    expect(out).toContain("{a\\textless{}b\\textgreater{}\\textbar{}c{-}{-}d}");
  });

  it("asks for T1 font encoding so Polish letters compile", () => {
    const out = TikzCodec.serialize(
      net({
        places: [{ id: "p", name: "łąka ręka", tokens: 0, position: { x: 0, y: 0 } }],
        arcs: [],
      }),
    );
    expect(out).toContain("%   \\usepackage[T1]{fontenc}");
    expect(out).toContain("{łąka ręka}");
  });

  it("is deterministic and balanced for the sample net", () => {
    const first = TikzCodec.serialize(SAMPLE_NET);
    expect(TikzCodec.serialize(SAMPLE_NET)).toBe(first);
    const count = (ch: string): number => first.split(ch).length - 1;
    expect(count("{")).toBe(count("}"));
    expect(count("[")).toBe(count("]"));
    expect(first.match(/\\begin\{tikzpicture\}/g)).toHaveLength(1);
    expect(first).toContain("\\end{tikzpicture}");
  });
});
