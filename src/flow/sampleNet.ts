import type { PetriNet } from "@/domain/types";

/**
 * A small built-in net rendered on first load so the canvas always has content.
 * It exercises every place glyph (empty / dots / number), a rotated transition, and
 * arcs (including one with multiplicity > 1 to show the weight label). Arc endpoints
 * are clipped to the node borders — the rendering convention for magnetic arcs.
 * A later milestone replaces this default with autosave/import.
 */
export const SAMPLE_NET: PetriNet = {
  places: [
    { id: "p-ready", name: "ready", tokens: 1, position: { x: -120, y: -80 } },
    { id: "p-waiting", name: "waiting", tokens: 3, position: { x: -120, y: 80 } },
    { id: "p-buffer", name: "buffer", tokens: 7, position: { x: 160, y: 0 } },
    { id: "p-done", name: "done", tokens: 0, position: { x: 420, y: 0 } },
  ],
  transitions: [
    { id: "t-start", name: "start", position: { x: 20, y: 0 } },
    { id: "t-finish", name: "finish", position: { x: 300, y: 0 }, gui: { rotation: 90 } },
  ],
  arcs: [
    {
      id: "a-ready-start",
      source: "p-ready",
      target: "t-start",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        { x: -102.636, y: -70.077 },
        { x: 12.5, y: -4.286 },
      ],
    },
    {
      id: "a-waiting-start",
      source: "p-waiting",
      target: "t-start",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        { x: -102.636, y: 70.077 },
        { x: 12.5, y: 4.286 },
      ],
    },
    {
      id: "a-start-buffer",
      source: "t-start",
      target: "p-buffer",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        { x: 27.5, y: 0 },
        { x: 140, y: 0 },
      ],
    },
    {
      id: "a-buffer-finish",
      source: "p-buffer",
      target: "t-finish",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 2,
      points: [
        { x: 180, y: 0 },
        { x: 280, y: 0 },
      ],
    },
    {
      id: "a-finish-done",
      source: "t-finish",
      target: "p-done",
      srcMagnetic: true,
      destMagnetic: true,
      multiplicity: 1,
      points: [
        { x: 320, y: 0 },
        { x: 400, y: 0 },
      ],
    },
  ],
};
