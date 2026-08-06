/**
 * Web material registry. On native, ViroMaterials.createMaterials() pushes
 * definitions into the VRTMaterialManager native module. On web there is no
 * native module, so ViroMaterials.web stores definitions here, and node
 * components resolve them by name to build materials through the C API.
 *
 * Supports color, lighting model, scalar properties (shininess/fresnel/
 * roughness/metalness/cull/blend/depth), and textures (diffuse + PBR maps).
 * Textures load asynchronously and are applied when ready.
 */
import type { ViroSceneApi, ViroHandle } from "@reactvision/viro-web-renderer";
export interface ViroWebMaterialDef {
    diffuseColor?: string | number;
    lightingModel?: string;
    [key: string]: unknown;
}
export declare function registerViroMaterials(materials: Record<string, ViroWebMaterialDef>): void;
export declare function getViroMaterialDef(name: string): ViroWebMaterialDef | undefined;
/** Drop cached material handles (call when the renderer/module is disposed). */
export declare function resetMaterialCache(): void;
/**
 * Build a native material from a registered definition and return its handle,
 * or 0 if the name isn't registered. Textures apply asynchronously.
 */
export declare function createMaterialFromRegistry(scene: ViroSceneApi, name: string): ViroHandle;
/**
 * Get (creating if needed) the shared material handle for a registered name.
 * Used by ViroMaterialVideo to drive video frames onto a named material.
 */
export declare function getSharedMaterialHandle(scene: ViroSceneApi, name: string): ViroHandle;
