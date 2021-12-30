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
const AssetRegistry_1 = __importDefault(require("react-native/Libraries/Image/AssetRegistry"));
const resolveAssetSource = require("react-native/Libraries/Image/resolveAssetSource");
var MaterialManager = react_native_1.NativeModules.VRTMaterialManager;
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
                            var cubeMapSource = resolveAssetSource(material[prop][cubeMapTexture]);
                            reflectiveShape[cubeMapTexture] = cubeMapSource;
                        }
                        resultMaterial[prop] = reflectiveShape;
                    }
                    else if (material[prop].hasOwnProperty("source")) {
                        var source = resolveAssetSource(material[prop]["source"]);
                        resultMaterial[prop] = material[prop];
                        resultMaterial[prop]["source"] = source;
                    }
                    else {
                        var assetType = "unknown";
                        if (typeof material[prop] !== "object") {
                            var asset = AssetRegistry_1.default.getAssetByID(material[prop]);
                            if (asset) {
                                assetType = asset.type;
                            }
                        }
                        var source = resolveAssetSource(material[prop]);
                        source["type"] = assetType;
                        resultMaterial[prop] = source;
                    }
                }
                else if (prop.endsWith("color") || prop.endsWith("Color")) {
                    var color = (0, react_native_1.processColor)(material[prop]);
                    resultMaterial[prop] = color;
                }
                else {
                    //just apply material property directly.
                    resultMaterial[prop] = material[prop];
                }
                result[key] = resultMaterial;
            }
        }
        MaterialManager.setJSMaterials(result);
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
}
exports.ViroMaterials = ViroMaterials;
