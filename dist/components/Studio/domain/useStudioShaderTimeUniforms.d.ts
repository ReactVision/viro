import { StudioAsset } from "../types";
/**
 * Drives the `time` shader uniform for materials that use animated presets.
 * Uses `setInterval(16)` and `Date.now() % 1000000` like working Viro starter kits.
 */
export declare function useStudioShaderTimeUniforms(assets: StudioAsset[]): void;
