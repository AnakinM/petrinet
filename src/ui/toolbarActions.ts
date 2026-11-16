import type { PetriNet } from "@/domain/types";
import { Analytics } from "@/lib/analytics";
import { ImageFile, NetFile, NetImportError, NpnFile, PnmlFile } from "@/lib/download";
import { useBuildStore } from "@/store/buildStore";
import { useNetStore } from "@/store/netStore";
import { useSimStore } from "@/store/simStore";

/**
 * The net-level menu actions (New / Import / the several Exports) and the Build↔Simulate mode
 * transitions, factored out of the toolbar so the desktop {@link Toolbar} and the mobile top bar
 * invoke the exact same logic. Each reads the live store on call, so there is no state to thread.
 */

const EMPTY_NET: PetriNet = { places: [], transitions: [], arcs: [] };

export function newNet(): void {
  if (window.confirm("Discard the current net and start a new one?")) {
    useNetStore.getState().setNet(EMPTY_NET);
  }
}

export function importNet(): void {
  NetFile.open()
    .then(({ net, format }) => {
      useNetStore.getState().setNet(net);
      Analytics.track("Import", { format, method: "button" });
    })
    .catch((error: Error) => {
      if (error instanceof NetImportError) {
        Analytics.track("Import refused", { format: error.format, reason: "invalid" });
      }
      window.alert(`Import failed: ${error.message}`);
    });
}

/** Export the native `.npn` (always the initial marking M0). */
export function exportNet(): void {
  NpnFile.save(useNetStore.getState().net);
  Analytics.track("Export", { format: "npn" });
}

/**
 * The net to render to an image: M0 in Build, but the live working marking in Simulate, so the
 * export always matches what the user currently sees on the canvas.
 */
function imageNet(): PetriNet {
  const { net, mode } = useNetStore.getState();
  if (mode !== "simulate") return net;
  const { marking } = useSimStore.getState();
  return { ...net, places: net.places.map((p) => ({ ...p, tokens: marking[p.id] ?? p.tokens })) };
}

/** Export PNML: a structural export (M0, like `.npn`). */
export function exportPnml(): void {
  PnmlFile.save(useNetStore.getState().net);
  Analytics.track("Export", { format: "pnml" });
}

/** Export a raster PNG of what's on screen. */
export function exportPng(): void {
  ImageFile.savePng(imageNet());
  // Counted when the export starts: the PNG itself is drawn asynchronously afterwards.
  Analytics.track("Export", { format: "png" });
}

/** Export a vector SVG of what's on screen. */
export function exportSvg(): void {
  ImageFile.saveSvg(imageNet());
  Analytics.track("Export", { format: "svg" });
}

/** Enter Simulate: drop any active Build tool, clear the selection, lock the net, snapshot M0. */
export function enterSimulate(): void {
  const store = useNetStore.getState();
  if (store.mode === "simulate") return;
  useBuildStore.getState().setTool("idle");
  store.select({ nodes: [], edges: [] });
  store.setMode("simulate");
  useSimStore.getState().start(store.net);
  Analytics.track("Enter simulation");
}

/** Return to Build and drop the simulation working copy. */
export function enterBuild(): void {
  const store = useNetStore.getState();
  if (store.mode === "build") return;
  store.setMode("build");
  useSimStore.getState().stop();
}
