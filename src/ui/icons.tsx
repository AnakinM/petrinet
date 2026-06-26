import type { JSX } from "react";

/**
 * Shared inline-SVG icons (no icon-font / image dependency), all inheriting `currentColor`.
 * The toolbar glyphs render at 16px; the verdict glyphs are sized by their `className`.
 */

/** A 3×3 grid (hash) — the snap-to-grid toggle. */
export function GridIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
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
