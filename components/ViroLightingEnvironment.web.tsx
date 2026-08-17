/**
 * Web implementation of ViroLightingEnvironment — applies an HDR image-based
 * lighting environment to the scene (diffuse irradiance + specular reflections
 * for PBR materials). Scene-level (renders no node).
 *
 * `source` must be a radiance `.hdr` (equirectangular). The renderer fetches it,
 * writes it to the WASM FS, and loads it via VROHDRLoader.
 */
import { useEffect } from "react";
import { useViroRenderer } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";

type Props = {
  source: unknown;
  onLoadEnd?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function ViroLightingEnvironment(props: Props): null {
  const renderer = useViroRenderer();
  const url = resolveImageSource(props.source);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    renderer
      .loadLightingEnvironment(url)
      .then((handle) => {
        if (cancelled) return;
        if (handle) props.onLoadEnd?.();
        else props.onError?.(new Error(`failed to load HDR environment: ${url}`));
      })
      .catch((err) => {
        if (!cancelled) props.onError?.(err);
      });
    return () => {
      cancelled = true;
      renderer.clearLightingEnvironment();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return null;
}
