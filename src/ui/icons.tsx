import type { JSX } from "react";

/** Shared inline-SVG icons (no icon-font / image dependency). 16px, inheriting `currentColor`. */

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
