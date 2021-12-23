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

import {
  ColorValue,
  ImageResolvedAssetSource,
  NativeModules,
  processColor,
} from "react-native";
// @ts-ignore
import assetRegistry from "react-native/Libraries/Image/AssetRegistry";
const resolveAssetSource = require("react-native/Libraries/Image/resolveAssetSource");
import { ViroSource } from "../Types/ViroUtils";

var MaterialManager = NativeModules.VRTMaterialManager;

// Reflective textures are cube maps(nx, px, ny, py, nz, pz), which is
// left(negative x), right(positive x), down(neg y), up(pos y), forward(neg z), backward(pos z)

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

export type ViroMaterial = {
  shininess?: number;
  fresnelExponent?: number;
  lightingModel?: "Phong" | "Blinn" | "Lambert" | "Constant" | "PBR";
  writesToDepthBuffer?: boolean;
  readsFromDepthBuffer?: boolean;
  colorWritesMask?: "None" | "Red" | "Green" | "Blue" | "Alpha" | "All";
  cullMode?: "None" | "Back" | "Front";
  blendMode?: "None" | "Alpha" | "Add" | "Subtract" | "Multiply" | "Screen";
  diffuseTexture?: any; // TODO: types
  diffuseIntensity?: number;
  specularTexture?: any; // TODO: types
  normalTexture?: any; // TODO: types
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
  roughnessTexture?: any; // TODO: types
  metalness?: number;
  metalnessTexture?: any; // TODO: types
  ambientOcclusionTexture?: any; // TODO: types
};

export type ViroMaterialDict = {
  [key: string]: ViroMaterial;
};

export class ViroMaterials {
  static createMaterials(materials: ViroMaterialDict) {
    var result: any = {};
    for (var key in materials) {
      var material = materials[key] as any; // TODO: as ViroMaterial; // types weren't working
      var resultMaterial: any = {};
      for (var prop in material) {
        //not the best check, modify to make sure property ends with texture..
        if (prop.endsWith("texture") || prop.endsWith("Texture")) {
          //textures point to assets, so lets resolve the asset
          if (prop === "ReflectiveTexture" || prop === "reflectiveTexture") {
            var reflectiveShape: any = {};
            for (var cubeMapTexture in material[prop]) {
              var cubeMapSource = resolveAssetSource(
                material[prop][cubeMapTexture]
              );
              reflectiveShape[cubeMapTexture] = cubeMapSource;
            }
            resultMaterial[prop] = reflectiveShape;
          } else if (material[prop].hasOwnProperty("source")) {
            var source = resolveAssetSource(material[prop]["source"]);
            resultMaterial[prop] = material[prop];
            resultMaterial[prop]["source"] = source;
          } else {
            var assetType = "unknown";
            if (typeof material[prop] !== "object") {
              var asset = assetRegistry.getAssetByID(material[prop]);
              if (asset) {
                assetType = asset.type;
              }
            }

            var source = resolveAssetSource(material[prop]);
            source["type"] = assetType;
            resultMaterial[prop] = source;
          }
        } else if (prop.endsWith("color") || prop.endsWith("Color")) {
          var color = processColor(material[prop]);
          resultMaterial[prop] = color;
        } else {
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
  static deleteMaterials(materials: any) {
    MaterialManager.deleteMaterials(materials);
  }
}
