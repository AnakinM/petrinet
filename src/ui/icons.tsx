import type { JSX, ReactNode } from "react";

/**
 * Shared inline-SVG icons (no icon-font / image dependency), all inheriting `currentColor`.
 * The toolbar glyphs render at 16px; the verdict glyphs are sized by their `className`.
 */

/** Shared 16px frame for the toolbar glyphs — currentColor stroke, round caps/joins. */
function ToolbarIcon({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** A 3×3 grid (hash) — the snap-to-grid toggle. */
export function GridIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </ToolbarIcon>
  );
}

/** A document with a plus — New (start a fresh net). */
export function NewIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6M9 15h6" />
    </ToolbarIcon>
  );
}

/** A tray with a down arrow — Import (load a file in). */
export function ImportIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </ToolbarIcon>
  );
}

/** A tray with an up arrow — Export (save a file out). */
export function ExportIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </ToolbarIcon>
  );
}

/** A curved arrow back to the left — Undo. */
export function UndoIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h10a5 5 0 0 1 5 5v1" />
    </ToolbarIcon>
  );
}

/** A curved arrow forward to the right — Redo. */
export function RedoIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H10a5 5 0 0 0-5 5v1" />
    </ToolbarIcon>
  );
}

/** Shared stroke options for the verdict glyphs — bold enough to read white-on-colour when small. */
function Glyph({
  className,
  children,
}: {
  className?: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** A check mark — the "yes" verdict badge. */
export function CheckIcon({ className }: { className?: string }): JSX.Element {
  return (
    <Glyph className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Glyph>
  );
}

/** An ✕ — the "no" verdict badge. */
export function CrossIcon({ className }: { className?: string }): JSX.Element {
  return (
    <Glyph className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Glyph>
  );
}

/** A question mark — the "unknown" (indeterminate) verdict badge. */
export function QuestionIcon({ className }: { className?: string }): JSX.Element {
  return (
    <Glyph className={className}>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </Glyph>
  );
}
