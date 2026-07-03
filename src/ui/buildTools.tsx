import type { JSX } from "react";
import type { BuildTool } from "@/store/buildStore";

/**
 * A Palette / mobile-dock tool entry: the {@link BuildTool} it activates, its label, and the
 * swatch shown inside the button. Swatches inherit `currentColor`, so they invert when their tool
 * is active. Shared so the desktop {@link Palette} (vertical) and the mobile tool dock (horizontal)
 * render the same set — adding a tool here surfaces it in both.
 */
export interface ToolDescriptor {
  id: Exclude<BuildTool, "idle">;
  label: string;
  swatch: JSX.Element;
}

export const TOOLS: ToolDescriptor[] = [
  {
    id: "place",
    label: "Place",
    swatch: <span className="h-5 w-5 rounded-full border-2 border-current" />,
  },
  {
    id: "transition",
    label: "Transition",
    swatch: <span className="h-5 w-[7px] bg-current" />,
  },
  { id: "arc", label: "Arc", swatch: <ArcSwatch /> },
  {
    id: "select",
    label: "Select",
    swatch: <span className="h-5 w-5 rounded-[2px] border border-current border-dashed" />,
  },
  { id: "token", label: "Token", swatch: <TokenSwatch /> },
];

/** A short arrow — draw an arc between two nodes. */
function ArcSwatch(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19 19 5" />
      <path d="M12 5h7v7" />
    </svg>
  );
}

/** A ringed dot — add a token to a place. */
function TokenSwatch(): JSX.Element {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-current">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}
