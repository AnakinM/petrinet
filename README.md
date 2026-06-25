# Petri Net Editor & Simulator

A browser-based editor and simulator for classic **place/transition (P/T) Petri nets**. Drag places
and transitions onto an infinite-grid canvas, wire them together with arcs, then switch to Simulate
mode to fire transitions and watch tokens flow. Import and export the `.npn` JSON format with
**byte-level fidelity**.

Client-only — no backend, no database, no accounts. Your work stays in the browser
(in-memory + `localStorage`).

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg?logo=typescript&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-build-646CFF.svg?logo=vite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-runtime-000000.svg?logo=bun&logoColor=white)

> **Status — active development.** The pure core is implemented and unit-tested: the normalized net
> model, the framework-free firing engine, and the byte-faithful `.npn` codec. The canvas, editing
> UI, and simulation controls are being built on top of it. Expect rapid change.

## Features

- **Visual editor** — drag-and-drop places and transitions onto an infinite, pannable and zoomable
  grid canvas.
- **Faithful arcs** — weighted arcs with multi-point waypoints, magnetic or free endpoints, and
  movable weight labels.
- **Build / Simulate split** — a hard separation between editing and running; Simulate mode locks the
  structure so you can fire transitions safely.
- **Classic P/T semantics** — strict weighted place/transition nets, driven by a pure, framework-free
  firing engine that is unit-testable in isolation (and ready for a future auto-runner and analysis
  tools).
- **Byte-faithful `.npn` I/O** — round-tripping an unedited file reproduces it byte-for-byte (UTF-8
  BOM, minified JSON, preserved key order). Import is lenient and **forward-compatible**: unknown
  fields are preserved so files from future versions survive a round-trip.
- **Undo / redo** — full history while building, with continuous drags coalesced into single steps.
- **Autosave** — your net and viewport persist to `localStorage`.

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) |
| UI | React 18 |
| Build tool | Vite |
| Canvas | React Flow (`@xyflow/react`) |
| State / history | Zustand + zundo |
| Styling | Tailwind CSS |
| Tests | Vitest |
| Lint / format | Biome |
| Runtime / package manager | Bun |

## Getting started

Prerequisites: [Bun](https://bun.sh).

```sh
bun install      # install dependencies
bun run dev      # start the dev server -> http://localhost:5173
```

### Scripts

```sh
bun run dev         # Vite dev server
bun run build       # typecheck + production build -> dist/
bun run preview     # serve the production build locally
bun run typecheck   # tsc --noEmit
bun run lint        # biome check
bun run format      # biome format --write
bun run test        # run the unit tests (Vitest)
```

### Docker

A multi-stage image builds the app and serves the static bundle with a tiny pure-Bun server:

```sh
docker build -t petrinet .
docker run --rm -p 3000:3000 petrinet   # http://localhost:3000
```

## The `.npn` format

The editor reads and writes `.npn`, a single-line minified JSON document (UTF-8 with BOM) describing a
net's `places`, `transitions`, and `arcs`. Two properties make the codec careful:

- **Byte-faithful export** — keys are written in a fixed canonical order and serialized with no
  spacing, so exporting an unedited file reproduces the original bytes exactly. There is a unit test
  that enforces this round-trip.
- **Lenient, forward-compatible import** — structure is validated (malformed input fails with a
  clear, specific error — never a silent partial load), optional fields default sensibly, and unknown
  per-element fields are preserved so a file produced by a newer version survives a round-trip
  unchanged.

## Architecture

The normalized domain model (`places` / `transitions` / `arcs`) is the **single source of truth**;
the React Flow nodes and edges are derived from it, and interactions map back into it. The firing
engine is **pure and framework-free** — no React, no DOM — exposing `enabledTransitions()` and
`fire()` with the firing policy decoupled, so it stays unit-testable and reusable.

## Roadmap

Planned improvements beyond the current version:

**Semantics**

- Extended Petri semantics: inhibitor arcs, read/test arcs, place capacities, colored tokens.
- Evolve the `.npn` format once extended semantics land.

**Simulation**

- Auto-run transport (play / pause / step) with adjustable speed and a conflict-resolution policy.
- Maximal-step firing mode (fire a maximal non-conflicting set of transitions per tick).
- Token-flow animation along arc polylines on fire.
- Deadlock / enabled-count indicator.
- Step-back / firing history during simulation.

**Export & interop**

- Image export (PNG / SVG snapshot of the canvas).
- Mid-simulation state snapshot export (write the live marking instead of the initial one).
- PNML import/export (ISO interchange) alongside `.npn`.

**Editor**

- Validation warnings: disconnected nodes, dangling/duplicate arcs, unnamed elements.
- Multiple nets: tabs / recent files, each autosaved.
- Node/label repositioning during Simulate (presentation mode) without unlocking topology.

**Infrastructure**

- CI (lint + typecheck + test) and pre-commit hooks.

## License

[MIT](LICENSE) © 2026 Mateusz Anikiej — free to use, modify, and distribute.
