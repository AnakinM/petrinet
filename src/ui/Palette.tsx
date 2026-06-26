import type { DragEvent, JSX } from "react";

/** MIME type carrying the node kind from a palette drag to the canvas drop handler. */
export const PETRI_NODE_MIME = "application/x-petri-node";

/** Which kind of node a palette item creates. */
export type PaletteNodeKind = "place" | "transition";

function onDragStart(event: DragEvent<HTMLButtonElement>, kind: PaletteNodeKind): void {
  event.dataTransfer.setData(PETRI_NODE_MIME, kind);
  event.dataTransfer.effectAllowed = "copy";
}

/** Drag sources for creating places and transitions by dropping them onto the canvas. */
export function Palette(): JSX.Element {
  return (
    <section className="flex flex-col gap-3 p-3">
      <h2 className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Palette</h2>
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, "place")}
        className="flex cursor-grab items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-slate-700 text-sm shadow-sm active:cursor-grabbing"
      >
        <span className="h-5 w-5 rounded-full border-2 border-slate-700" />
        Place
      </button>
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(e, "transition")}
        className="flex cursor-grab items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-slate-700 text-sm shadow-sm active:cursor-grabbing"
      >
        <span className="h-5 w-[7px] bg-slate-700" />
        Transition
      </button>
      <p className="mt-1 text-[11px] text-slate-400 leading-snug">Drag onto the canvas to add.</p>
    </section>
  );
}
