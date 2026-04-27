/**
 * Studio material_config parsing and Viro material definition building.
 * Ported from studio-go/domain/materialConfig.ts — no zod dependency.
 */
type ShaderModifierStage = {
    uniforms?: string;
    body?: string;
    varyings?: unknown;
    requiresSceneDepth?: boolean;
    requiresCameraTexture?: boolean;
    priority?: unknown;
};
export type MaterialConfig = {
    presetName?: string;
    lightingModel: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
    diffuseColor?: string;
    roughness?: number;
    metalness?: number;
    shininess?: number;
    alpha?: number;
    blendMode?: string;
    bloomThreshold?: number | null;
    wrapS?: "Clamp" | "Repeat" | "Mirror";
    wrapT?: "Clamp" | "Repeat" | "Mirror";
    diffuseTexture?: string | null;
    normalTexture?: string | null;
    roughnessTexture?: string | null;
    metalnessTexture?: string | null;
    ambientOcclusionTexture?: string | null;
    specularTexture?: string | null;
    shaderModifiers?: Record<string, ShaderModifierStage | string>;
    materialUniforms?: Array<{
        name: string;
        type: string;
        value: unknown;
    }>;
    transparencyMode?: string;
    cullMode?: string;
};
export type ViroMaterialDefinition = Record<string, unknown>;
export declare function materialConfigNeedsTimeUniform(config: MaterialConfig): boolean;
/**
 * True if the shader uses _rf_vpw/_rf_vph viewport uniforms.
 * These must be pushed via ViroMaterials.updateShaderUniform on mount and orientation change.
 */
export declare function materialConfigNeedsViewportUniforms(config: MaterialConfig): boolean;
export declare function studioMaterialName(assetId: string): string;
/**
 * Parses `scene_assets.material_config` JSON. Returns null if missing or invalid.
 */
export declare function parseMaterialConfig(raw: unknown): MaterialConfig | null;
/**
 * Maps a validated Studio material_config to Viro's `createMaterials` definition shape.
 */
export declare function buildViroMaterialDefinition(config: MaterialConfig): ViroMaterialDefinition;
export {};
