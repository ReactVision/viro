import { useEffect, useMemo } from "react";
import { ViroMaterials } from "../../Material/ViroMaterials";
import { useViroRenderer } from "../../Web/ViroWebContext";
import type { StudioAsset } from "../types";
import { studioViewportUniformMaterials } from "./materialConfig";

/**
 * Web twin of the native hook. gl_FragCoord is in the canvas's backing-store
 * pixels, which on the web is the canvas, not the screen: a desktop page's
 * canvas is rarely full screen.
 */
export function useStudioShaderViewportUniforms(assets: StudioAsset[]): void {
  const renderer = useViroRenderer();
  const payload = useMemo(() => studioViewportUniformMaterials(assets), [assets]);

  useEffect(() => {
    if (payload.names.length === 0) return;
    const push = () => {
      const { width, height } = renderer.canvasSize;
      for (const name of payload.names) {
        ViroMaterials.updateShaderUniform(name, "_rf_vpw", "float", width);
        ViroMaterials.updateShaderUniform(name, "_rf_vph", "float", height);
      }
    };
    push();
    // The navigator resizes the backing store from its own observer, which
    // may run after this one, so the size is read a frame later.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(push);
    });
    observer.observe(renderer.canvasElement);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [payload.key, renderer]);
}
