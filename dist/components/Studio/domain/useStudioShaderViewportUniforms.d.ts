import { StudioAsset } from "../types";
/**
 * Pushes _rf_vpw / _rf_vph (physical pixel dimensions) to materials that sample the camera
 * feed via gl_FragCoord. Called on mount and whenever the screen dimensions change.
 */
export declare function useStudioShaderViewportUniforms(assets: StudioAsset[]): void;
