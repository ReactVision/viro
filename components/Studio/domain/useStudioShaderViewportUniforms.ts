import { useCallback, useEffect, useMemo } from "react";
import { Dimensions, PixelRatio } from "react-native";
import { ViroMaterials } from "../../Material/ViroMaterials";
import { StudioAsset } from "../types";
import {
  materialConfigNeedsViewportUniforms,
  parseMaterialConfig,
  studioMaterialName,
} from "./materialConfig";

function computeViewportPayload(assets: StudioAsset[]): {
  key: string;
  names: string[];
} {
  const names: string[] = [];
  for (const asset of assets) {
    if (asset.asset_type_name !== "3D-MODEL") continue;
    if (asset.material_config == null) continue;
    const config = parseMaterialConfig(asset.material_config);
    if (!config || !materialConfigNeedsViewportUniforms(config)) continue;
    names.push(studioMaterialName(asset.id));
  }
  names.sort();
  return { key: names.join("|"), names };
}

/**
 * Pushes _rf_vpw / _rf_vph (physical pixel dimensions) to materials that sample the camera
 * feed via gl_FragCoord. Called on mount and whenever the screen dimensions change.
 */
export function useStudioShaderViewportUniforms(assets: StudioAsset[]): void {
  const payload = useMemo(() => computeViewportPayload(assets), [assets]);

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
