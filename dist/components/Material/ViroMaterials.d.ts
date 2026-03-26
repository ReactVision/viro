/**
 * Copyright (c) 2015-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroMaterials
 * @flow
 */
import { ColorValue, ImageResolvedAssetSource } from "react-native";
import { ViroSource } from "../Types/ViroUtils";
export type ViroCubeMap = {
    nx: ViroSource;
    px: ViroSource;
    ny: ViroSource;
    py: ViroSource;
    nz: ViroSource;
    pz: ViroSource;
};
export type ViroResolvedCubeMap = {
    nx: ImageResolvedAssetSource;
    px: ImageResolvedAssetSource;
    ny: ImageResolvedAssetSource;
    py: ImageResolvedAssetSource;
    nz: ImageResolvedAssetSource;
    pz: ImageResolvedAssetSource;
};
export type ViroSemanticMaskMode = "showOnly" | "hide" | "debug";
export type ViroSemanticLabel = "sky" | "building" | "tree" | "road" | "sidewalk" | "terrain" | "structure" | "object" | "vehicle" | "person" | "water";
export type ViroSemanticMaskConfig = {
    /** Whether to show the material only where the label matches, or to hide it there. */
    mode: ViroSemanticMaskMode;
    /** One or more semantic labels to match against. */
    labels: ViroSemanticLabel[];
};
export type ViroShaderModifier = {
    body?: string;
    uniforms?: string;
    /** Typed varying declarations shared between vertex and fragment stages.
     *  Each string is a GLSL type+name pair, e.g. "highp float displacement".
     *  The 'out' / 'in' qualifiers are added automatically. */
    varyings?: string[];
    /** When true the modifier may declare and sample
     *  'uniform sampler2D scene_depth_texture'.
     *  The engine auto-binds the previous frame's scene depth buffer (HDR mode only).
     *  The sampler is bound by name — this flag is informational metadata. */
    requiresSceneDepth?: boolean;
    /** When true the modifier may declare and sample 'uniform sampler2D camera_texture'.
     *  The engine auto-binds the live AR camera background texture.
     *  On Android (ARCore) the OES extension and samplerExternalOES are injected automatically.
     *  A 'uniform mat4 camera_image_transform' is also auto-bound for UV mapping. */
    requiresCameraTexture?: boolean;
};
export type ViroShaderModifiers = {
    geometry?: string | ViroShaderModifier;
    vertex?: string | ViroShaderModifier;
    surface?: string | ViroShaderModifier;
    fragment?: string | ViroShaderModifier;
    lightingModel?: string | ViroShaderModifier;
};
export type ViroShaderUniform = {
    name: string;
    type: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D";
    value: any;
};
export type ViroMaterial = {
    shininess?: number;
    fresnelExponent?: number;
    lightingModel?: "Phong" | "Blinn" | "Lambert" | "Constant" | "PBR";
    writesToDepthBuffer?: boolean;
    readsFromDepthBuffer?: boolean;
    colorWritesMask?: "None" | "Red" | "Green" | "Blue" | "Alpha" | "All";
    cullMode?: "None" | "Back" | "Front";
    blendMode?: "None" | "Alpha" | "Add" | "Subtract" | "Multiply" | "Screen";
    diffuseTexture?: any;
    diffuseIntensity?: number;
    specularTexture?: any;
    normalTexture?: any;
    reflectiveTexture?: ViroCubeMap;
    diffuseColor?: ColorValue;
    chromaKeyFilteringColor?: ColorValue;
    wrapS?: "Clamp" | "Repeat" | "Mirror";
    wrapT?: "Clamp" | "Repeat" | "Mirror";
    minificationFilter?: "Nearest" | "Linear";
    magnificationFilter?: "Nearest" | "Linear";
    mipFilter?: "Nearest" | "Linear";
    bloomThreshold?: number;
    roughness?: number;
    roughnessTexture?: any;
    metalness?: number;
    metalnessTexture?: any;
    ambientOcclusionTexture?: any;
    shaderModifiers?: ViroShaderModifiers;
    materialUniforms?: ViroShaderUniform[];
    /** Semantic masking — shows or hides the material based on ARCore scene semantics labels.
     *  Requires `setSemanticModeEnabled(true)` on the AR scene navigator.
     *  Only supported on Android (ARCore). Gracefully no-ops on iOS. */
    semanticMask?: ViroSemanticMaskConfig;
};
export type ViroMaterialDict = {
    [key: string]: ViroMaterial;
};
export declare class ViroMaterials {
    static createMaterials(materials: ViroMaterialDict): void;
    static deleteMaterials(materials: any): void;
    /**
     * Update a shader uniform value for a specific material.
     * This allows runtime animation of shader modifiers.
     *
     * @param materialName - The name of the material to update
     * @param uniformName - The name of the uniform variable (e.g., "time")
     * @param uniformType - The type of the uniform ("float", "vec2", "vec3", "vec4", "mat4", "sampler2D")
     * @param value - The new value (number for float, array for vectors/matrices)
     *
     * @example
     * // Update time uniform for animation
     * ViroMaterials.updateShaderUniform("wobblySphere", "time", "float", Date.now());
     *
     * @example
     * // Update color uniform
     * ViroMaterials.updateShaderUniform("myMaterial", "glowColor", "vec3", [1.0, 0.5, 0.0]);
     */
    static updateShaderUniform(materialName: string, uniformName: string, uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D", value: number | number[] | any): void;
}
