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
export declare type ViroCubeMap = {
    nx: ViroSource;
    px: ViroSource;
    ny: ViroSource;
    py: ViroSource;
    nz: ViroSource;
    pz: ViroSource;
};
export declare type ViroResolvedCubeMap = {
    nx: ImageResolvedAssetSource;
    px: ImageResolvedAssetSource;
    ny: ImageResolvedAssetSource;
    py: ImageResolvedAssetSource;
    nz: ImageResolvedAssetSource;
    pz: ImageResolvedAssetSource;
};
export declare type ViroMaterial = {
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
};
export declare type ViroMaterialDict = {
    [key: string]: ViroMaterial;
};
export declare class ViroMaterials {
    static createMaterials(materials: ViroMaterialDict): void;
    static deleteMaterials(materials: any): void;
}
