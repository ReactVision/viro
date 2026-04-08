import { useCallback, useEffect, useMemo, useRef } from "react";
import { ViroMaterials } from "../../Material/ViroMaterials";
import { StudioAsset } from "../types";
import {
  materialConfigNeedsTimeUniform,
  parseMaterialConfig,
  studioMaterialName,
} from "./materialConfig";

/** ~60fps — matches Viro starter kit / shader docs. */
const TIME_TICK_MS = 16;

function computeTimeUniformPayload(assets: StudioAsset[]): { key: string; names: string[] } {
  const names: string[] = [];
  for (const asset of assets) {
    if (asset.asset_type_name !== "3D-MODEL") continue;
    if (asset.material_config == null) continue;
    const config = parseMaterialConfig(asset.material_config);
    if (!config || !materialConfigNeedsTimeUniform(config)) continue;
    names.push(studioMaterialName(asset.id));
  }
  names.sort();
  return { key: names.join("|"), names };
}

/**
 * Drives the `time` shader uniform for materials that use animated presets.
 * Uses `setInterval(16)` and `Date.now() % 1000000` like working Viro starter kits.
 */
export function useStudioShaderTimeUniforms(assets: StudioAsset[]): void {
  const payload = useMemo(() => computeTimeUniformPayload(assets), [assets]);

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const applyTimeUniforms = useCallback(() => {
    const { names } = payloadRef.current;
    if (names.length === 0) return;
    const time = Date.now() % 1_000_000;
    for (const name of names) {
      ViroMaterials.updateShaderUniform(name, "time", "float", time);
    }
  }, []);

  useEffect(() => {
    if (payload.names.length === 0) return;
    const id = setInterval(applyTimeUniforms, TIME_TICK_MS);
    applyTimeUniforms();
    return () => clearInterval(id);
  }, [payload.key, applyTimeUniforms]);
}
