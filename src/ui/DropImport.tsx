import { type JSX, useEffect, useState } from "react";
import { useNetStore } from "@/store/netStore";
import { importDroppedFile } from "@/ui/toolbarActions";

/**
 * Import by drop: a net file dropped anywhere on the editor opens as the Import button would open
 * it. While a file is dragged over the window in Build mode, an overlay says "Drop to import".
 * Simulate shows no overlay and refuses the drop, as its Import button is disabled.
 *
 * The browser's own handling of a dropped file is always prevented, in both modes. Without that it
 * would leave the app and show the raw file. Drags that carry no file (text, links) are left alone.
 */
export function DropImport(): JSX.Element | null {
  const [over, setOver] = useState(false);

  useEffect(() => {
    // dragenter and dragleave fire for every element under the pointer, so count them.
    let depth = 0;
    const building = (): boolean => useNetStore.getState().mode === "build";

    const onDragEnter = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setOver(building());
    };
    const onDragOver = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = building() ? "copy" : "none";
    };
    const onDragLeave = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    // A browser may skip a dragleave (Firefox does), so the end of any drag starts the count anew.
    const reset = (): void => {
      depth = 0;
      setOver(false);
    };
    const onDrop = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      reset();
      // Only the first file counts.
      const file = e.dataTransfer?.files[0];
      if (file) importDroppedFile(file);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  if (!over) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4">
      <div className="rounded-lg border-2 border-on-inverse border-dashed bg-inverse/90 px-8 py-6 font-semibold text-lg text-on-inverse shadow-lg">
        Drop to import
      </div>
    </div>
  );
}

function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}
