import { useCallback, useEffect, useMemo } from "react";
import { Dimensions, PixelRatio } from "react-native";
import { ViroMaterials } from "../../Material/ViroMaterials";
import { StudioAsset } from "../types";
import { studioViewportUniformMaterials } from "./materialConfig";

/**
 * Pushes _rf_vpw / _rf_vph (physical pixel dimensions) to materials that sample the camera
 * feed via gl_FragCoord. Called on mount and whenever the screen dimensions change.
 */
export function useStudioShaderViewportUniforms(assets: StudioAsset[]): void {
  const payload = useMemo(() => studioViewportUniformMaterials(assets), [assets]);

  const pushViewport = useCallback(() => {
    if (payload.names.length === 0) return;
    const { width, height } = Dimensions.get("screen");
    const pr = PixelRatio.get();
    const pw = width * pr;
    const ph = height * pr;
    for (const name of payload.names) {
      ViroMaterials.updateShaderUniform(name, "_rf_vpw", "float", pw);
      ViroMaterials.updateShaderUniform(name, "_rf_vph", "float", ph);
    }
  }, [payload]);

  useEffect(() => {
    if (payload.names.length === 0) return;
    pushViewport();
    const sub = Dimensions.addEventListener("change", pushViewport);
    return () => sub.remove();
  }, [payload.key, pushViewport]);
}
