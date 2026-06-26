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

/**
 * The GitHub "Octocat" mark — solid/fill-based (unlike the stroke toolbar glyphs), 16px.
 * Used in the left-sidebar footer link row.
 */
export function GitHubIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** A bug — the "Report an issue" link glyph (stroke-based, matches the toolbar weight). */
export function BugIcon(): JSX.Element {
  return (
    <ToolbarIcon>
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
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
