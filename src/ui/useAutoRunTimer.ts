import { useEffect } from "react";
import { useSimStore } from "@/store/simStore";

/**
 * The Simulate auto-run timer. While `playing`, fires `step()` every (1000 / speed) ms; the pure
 * engine does the actual firing and clears `playing` itself at a dead marking, which tears the
 * interval down via this effect's cleanup. Call from exactly one mounted transport at a time — the
 * desktop {@link SimControls} or the mobile tool dock, which never render together (the shell picks
 * one by breakpoint).
 */
export function useAutoRunTimer(): void {
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => useSimStore.getState().step(), 1000 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);
}
