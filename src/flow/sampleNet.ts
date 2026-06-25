import type { PetriNet } from "@/domain/types";

/**
 * A small built-in net rendered on first load so the canvas always has content.
 * It exercises every place glyph (empty / dots / number) and a rotated transition.
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
        { x: -120, y: -80 },
        { x: 20, y: 0 },
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
        { x: -120, y: 80 },
        { x: 20, y: 0 },
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
        { x: 20, y: 0 },
        { x: 160, y: 0 },
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
        { x: 160, y: 0 },
        { x: 300, y: 0 },
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
        { x: 300, y: 0 },
        { x: 420, y: 0 },
      ],
    },
  ],
};
