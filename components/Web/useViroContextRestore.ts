import { useEffect, useRef, useState } from "react";
import type { ViroWebRenderer } from "@reactvision/viro-web-renderer";

/**
 * A navigator's renderer generation, bumped when the browser gives back a WebGL
 * context it took away. Nothing the old renderer built survives that, so the
 * navigator runs `clear` (drop the renderer, which unmounts the scene) and its
 * creation effect, keyed on the generation, makes a new renderer the scene
 * mounts into again. Native has no equivalent: a phone keeps its GL context.
 */
export function useViroContextRestore(renderer: ViroWebRenderer | null, clear: () => void): number {
  const [generation, setGeneration] = useState(0);
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => {
    // Renderer 1.1.1 reports no context loss.
    if (!renderer || typeof renderer.addContextListener !== "function") return;
    return renderer.addContextListener({
      onLost: () => console.warn("[Viro web] WebGL context lost; the scene remounts when it is restored"),
      onRestored: () => {
        clearRef.current();
        setGeneration((g) => g + 1);
      },
    });
  }, [renderer]);
  return generation;
}
