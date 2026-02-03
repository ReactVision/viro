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
export type ViroShaderModifier = {
    body?: string;
    uniforms?: string;
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
     * @param uniformType - The type of the uniform ("float", "vec2", "vec3", "vec4", "mat4")
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
    static updateShaderUniform(materialName: string, uniformName: string, uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4", value: number | number[]): void;
}
