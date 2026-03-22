"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterials = void 0;
const react_native_1 = require("react-native");
// @ts-ignore
const AssetRegistry_1 = require("react-native/Libraries/Image/AssetRegistry");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
var MaterialManager = react_native_1.NativeModules.VRTMaterialManager ||
    react_native_1.TurboModuleRegistry.get("VRTMaterialManager");
console.log("VRTMaterialManager lookup:", MaterialManager ? "FOUND" : "NOT FOUND");
// Maps VROSemanticLabel enum value → bit position (bit N = label N, value 1-11).
const kSemanticLabelBit = {
    sky: 1 << 1,
    building: 1 << 2,
    tree: 1 << 3,
    road: 1 << 4,
    sidewalk: 1 << 5,
    terrain: 1 << 6,
    structure: 1 << 7,
    object: 1 << 8,
    vehicle: 1 << 9,
    person: 1 << 10,
    water: 1 << 11,
};
class ViroMaterials {
    static createMaterials(materials) {
        var result = {};
        for (var key in materials) {
            var material = materials[key]; // TODO: as ViroMaterial; // types weren't working
            var resultMaterial = {};
            for (var prop in material) {
                //not the best check, modify to make sure property ends with texture..
                if (prop.endsWith("texture") || prop.endsWith("Texture")) {
                    //textures point to assets, so lets resolve the asset
                    if (prop === "ReflectiveTexture" || prop === "reflectiveTexture") {
                        var reflectiveShape = {};
                        for (var cubeMapTexture in material[prop]) {
                            var cubeMapSource = (0, resolveAssetSource_1.default)(material[prop][cubeMapTexture]);
                            reflectiveShape[cubeMapTexture] = cubeMapSource;
                        }
                        resultMaterial[prop] = reflectiveShape;
                    }
                    else if (material[prop].hasOwnProperty("source")) {
                        var source = (0, resolveAssetSource_1.default)(material[prop]["source"]);
                        resultMaterial[prop] = material[prop];
                        resultMaterial[prop]["source"] = source;
                    }
                    else {
                        var assetType = "unknown";
                        if (typeof material[prop] !== "object") {
                            var asset = (0, AssetRegistry_1.getAssetByID)(material[prop]);
                            if (asset) {
                                assetType = asset.type;
                            }
                        }
                        var source = (0, resolveAssetSource_1.default)(material[prop]);
                        if (source) {
                            source["type"] = assetType;
                            resultMaterial[prop] = source;
                        }
                    }
                }
                else if (prop.endsWith("color") || prop.endsWith("Color")) {
                    var color = (0, react_native_1.processColor)(material[prop]);
                    resultMaterial[prop] = color;
                }
                else if (prop === "semanticMask") {
                    const config = material[prop];
                    let labelMask = 0;
                    for (const label of config.labels) {
                        labelMask |= kSemanticLabelBit[label] ?? 0;
                    }
                    resultMaterial["semanticMask"] = {
                        mode: config.mode,
                        labelMask,
                    };
                }
                else {
                    //just apply material property directly.
                    resultMaterial[prop] = material[prop];
                }
            }
            result[key] = resultMaterial;
        }
        if (MaterialManager) {
            MaterialManager.setJSMaterials(result);
        }
        else {
            console.error("ViroMaterials: MaterialManager (NativeModules.VRTMaterialManager) is not available!");
        }
    }
    /*
    This function tells the platform to delete/release the given materials from
    memory. This means that the given materials can no longer be referenced. Existing
    components that have already had their materials set will continue to work.
  
    materials - an array of material names to delete
     */
    static deleteMaterials(materials) {
        MaterialManager.deleteMaterials(materials);
    }
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
    static updateShaderUniform(materialName, uniformName, uniformType, value) {
        if (!MaterialManager) {
            console.error("ViroMaterials: MaterialManager is not available for uniform update");
            return;
        }
        MaterialManager.updateShaderUniform(materialName, uniformName, uniformType, value);
    }
}
exports.ViroMaterials = ViroMaterials;
