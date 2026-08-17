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
import type { ViroShaderModifiers } from "../Material/ViroMaterials";
export interface ViroWebMaterialDef {
    diffuseColor?: string | number;
    lightingModel?: string;
    shaderModifiers?: ViroShaderModifiers;
    [key: string]: unknown;
}
export declare function registerViroMaterials(materials: Record<string, ViroWebMaterialDef>): void;
export declare function getViroMaterialDef(name: string): ViroWebMaterialDef | undefined;
/**
 * ViroMaterials.deleteMaterials's web backend. Mirrors MaterialManager.java's
 * deleteMaterials: for each name, if it was already built, destroy its native
 * handle before dropping it; either way, drop the definition so a later
 * createMaterials() for the same name starts clean.
 */
export declare function deleteViroMaterials(materialNames: string[]): void;
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
/**
 * ViroMaterials.updateShaderUniform's web backend. Mirrors
 * MaterialManager.java::updateShaderUniform: resolve the material by name,
 * dispatch on uniformType. Requires the uniform to be declared in a
 * shaderModifier already attached to the material (see applyShaderModifiers)
 * — the value has nowhere to go otherwise, same as native.
 *
 * "vec2" is a web-only superset today: the native Android/iOS bridges don't
 * expose it (their RN methods have no vec2 branch), but the underlying engine
 * (VROMaterial) now has a real vec2 uniform map, added for this. Values
 * written here won't do anything on native until those bridges add a
 * matching branch.
 */
export declare function updateMaterialShaderUniform(materialName: string, uniformName: string, uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D", value: unknown): void;
