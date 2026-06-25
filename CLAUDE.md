# Guidelines for AI in the Petri Net Editor project

## Project

Browser-based **Petri net editor + simulator**. Drag-and-drop places/transitions onto an
infinite grid canvas, wire them with arcs, then switch to Simulate mode to fire transitions
and watch tokens move. Import/export the `.npn` JSON format with **byte-level fidelity**.

Client-only. No backend, no database, no accounts. State lives in memory + `localStorage`.

See `PLAN.md` for the full implementation plan and the deferred "Future Updates" list.

## Commands

Use **bun** for everything. No Makefile, no docker-compose. A Dockerfile is required.

```sh
bun install            # install dependencies
bun run dev            # Vite dev server on :5173
bun run build          # tsc typecheck + Vite production build -> dist/
bun run preview        # serve the production build locally
bun run typecheck      # tsc --noEmit
bun run lint           # biome check .
bun run format         # biome format --write .
bun run test           # vitest run (one-shot)
bun run test:watch     # vitest watch

bun add <pkg>          # add a dependency (ASK FIRST)

docker build -t petrinet .                 # multi-stage: bun build -> pure-bun static serve
docker run --rm -p 3000:3000 petrinet      # app at http://localhost:3000
```

## Stack — do not add libraries without asking first

- **Runtime / package manager:** bun
- **App:** React 18 + TypeScript (strict) + Vite
- **Canvas:** `@xyflow/react` (React Flow v12)
- **State:** Zustand (net domain model + UI state) + **zundo** (undo/redo history)
- **Styling:** Tailwind
- **Tests:** Vitest (+ React Testing Library / jsdom for components)
- **Lint + format:** Biome (single tool; swappable to ESLint+Prettier if ever needed)

## Compatibility — the `.npn` format is a hard contract

- Export is **byte-faithful**: UTF-8 **BOM**, single-line **minified** JSON, **preserved key
  order**, **no trailing newline**. Each arc's *current* geometry is serialized back into `points`.
- Round-tripping `export-12.npn` with no edits must produce a **byte-identical** file. There is a
  Vitest test that enforces this. Never regress it.
- Import is **lenient and forward-compatible**: validate structure, default missing optional fields
  (e.g. absent `labelPosition`), and **preserve unknown/extra fields** per element so a future
  extended `.npn` survives a round-trip through this editor. Malformed input fails with a clear,
  specific error — never a silent partial load.
- Canonical key orders (top level): `places, transitions, arcs`.
  - place: `id, name, tokens, position, labelPosition?`
  - transition: `id, name, position, labelPosition?, gui?`
  - arc: `id, srcMagnetic, destMagnetic, multiplicity, points, labelPosition?`
  - point/position/labelPosition object: `x, y`

## Architecture — load-bearing rules

- The normalized **domain model is the single source of truth** (`places` / `transitions` / `arcs`).
  React Flow nodes/edges are **derived** from it; interactions map back into it. Never make React
  Flow state the source of truth.
- The **firing engine is pure and framework-free** — no React, no DOM, no store imports. It exposes
  `enabledTransitions()` and `fire(id)` with the firing *policy* decoupled, so a future auto-runner
  and analysis tools reuse it unchanged. It must be unit-testable in isolation.
- Export always writes the **initial marking M0**. The live simulation marking is a separate working
  copy that never persists (v1).
- **Strict classic P/T semantics** in v1, but keep arc `type` (default `"normal"`), place `capacity`,
  and enabledness **pluggable** so the future extended mode is configuration, not a rewrite. Do not
  implement inhibitor/read/capacity *behaviour* in v1.
- **Build** and **Simulate** are hard-separated modes; Simulate locks all structural editing.

## Code conventions

- **Strict TypeScript.** No `any` (use `unknown` + narrowing). Explicit types on every exported and
  function signature. No `// @ts-ignore` without a one-line justification.
- **Domain logic is class-based and cohesive** — `PetriNetEngine`, `NpnCodec`, net-operation classes.
  Use `static` methods when no instance state is needed. No loose junk-drawer util modules; behaviour
  lives on the class that owns it. Module level holds only constants, classes, enums, and types.
- **React layer is idiomatic functional** (function components, hooks, Zustand slices) — this is the
  one place the "behaviour-on-a-class" rule yields to framework idiom. Still: no `utils.ts` dumping
  ground. Co-locate behaviour with the store slice / hook / component it belongs to; group genuinely
  shared pure helpers into a named, cohesive module.
- **Simplicity first.** Minimum code that solves the problem; readable over clever. No error handling
  for impossible scenarios — only edge cases that can actually occur. Ask: "would a senior engineer
  call this overcomplicated?" If yes, simplify. If you wrote 200 lines and it could be 50, rewrite it.

## Naming (adapted to TS/React idiom)

- Files: React components `PascalCase.tsx`; everything else `camelCase.ts`.
- Classes / types / interfaces: `PascalCase`. Constants: `UPPER_SNAKE_CASE`. Private fields: `_prefixed`.
- Imports: grouped stdlib / third-party / local; absolute local imports via the `@/` → `src/` alias.

## Testing

- **Vitest.** Unit tests co-located as `*.test.ts(x)` next to the code they cover.
- The **`.npn` codec and the firing engine must have unit tests**, including the byte-identical
  round-trip test against `export-12.npn` (kept as a fixture).
- Group tests in `describe` blocks — no loose top-level tests.
- Testing pyramid: most coverage from pure-unit tests on `domain/` and `codec/`. Component tests cover
  each interactive surface's happy path plus an error path where one exists.

## Git workflow

- Main branch: `main`. Commit only when asked; branch first if asked to commit on `main`.
- Conventional, present-tense commit subjects. Keep diffs focused.
- CI and pre-commit hooks are a deferred item (see `PLAN.md` → Future Updates), not set up in v1.

## Boundaries

### Always do
- Put explicit types on all function signatures.
- Run `bun run lint` + `bun run typecheck` on changed files, and the related unit tests, before committing.
- Follow the patterns in neighbouring files; match existing style even if you'd personally do it differently.
- If multiple reasonable interpretations exist, **present them — don't pick silently.** Communication is key.
- If something is unclear, **stop**, name what's confusing, and discuss it before proceeding.

### Ask first
- Adding or upgrading dependencies (`bun add`).
- Changing the `Dockerfile` or any build/deploy configuration.
- Adding or changing CI workflows.
- Anything that touches the `.npn` serialization format or key ordering.

### Never do
- Commit `.env` files or hardcode credentials/secrets.
- Break `.npn` byte-compatibility or the `export-12.npn` round-trip test.
- Make React Flow state the source of truth instead of the domain model.
- Introduce a second state-management or diagramming library without flagging it first.
- Implement extended semantics (inhibitor/read arcs, capacities, colored tokens) in v1.
