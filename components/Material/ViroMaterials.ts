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
  TurboModuleRegistry,
} from "react-native";

// @ts-ignore
import { getAssetByID } from "react-native/Libraries/Image/AssetRegistry";

// @ts-ignore
import resolveAssetSource from "react-native/Libraries/Image/resolveAssetSource";
import { ViroSource } from "../Types/ViroUtils";

var MaterialManager =
  NativeModules.VRTMaterialManager ||
  TurboModuleRegistry.get("VRTMaterialManager");
console.log(
  "VRTMaterialManager lookup:",
  MaterialManager ? "FOUND" : "NOT FOUND"
);

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

export type ViroSemanticMaskMode = "showOnly" | "hide" | "debug";

export type ViroSemanticLabel =
  | "sky"
  | "building"
  | "tree"
  | "road"
  | "sidewalk"
  | "terrain"
  | "structure"
  | "object"
  | "vehicle"
  | "person"
  | "water";

export type ViroSemanticMaskConfig = {
  /** Whether to show the material only where the label matches, or to hide it there. */
  mode: ViroSemanticMaskMode;
  /** One or more semantic labels to match against. */
  labels: ViroSemanticLabel[];
};

// Maps VROSemanticLabel enum value → bit position (bit N = label N, value 1-11).
const kSemanticLabelBit: Record<ViroSemanticLabel, number> = {
  sky:       1 << 1,
  building:  1 << 2,
  tree:      1 << 3,
  road:      1 << 4,
  sidewalk:  1 << 5,
  terrain:   1 << 6,
  structure: 1 << 7,
  object:    1 << 8,
  vehicle:   1 << 9,
  person:    1 << 10,
  water:     1 << 11,
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
              var asset = getAssetByID(material[prop]);
              if (asset) {
                assetType = asset.type;
              }
            }

            var source = resolveAssetSource(material[prop]);
            if (source) {
              source["type"] = assetType;
              resultMaterial[prop] = source;
            }
          }
        } else if (prop.endsWith("color") || prop.endsWith("Color")) {
          var color = processColor(material[prop]);
          resultMaterial[prop] = color;
        } else if (prop === "semanticMask") {
          const config = material[prop] as ViroSemanticMaskConfig;
          let labelMask = 0;
          for (const label of config.labels) {
            labelMask |= kSemanticLabelBit[label] ?? 0;
          }
          resultMaterial["semanticMask"] = {
            mode: config.mode,
            labelMask,
          };
        } else {
          //just apply material property directly.
          resultMaterial[prop] = material[prop];
        }
      }
      result[key] = resultMaterial;
    }

    if (MaterialManager) {
      MaterialManager.setJSMaterials(result);
    } else {
      console.error(
        "ViroMaterials: MaterialManager (NativeModules.VRTMaterialManager) is not available!"
      );
    }
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
  static updateShaderUniform(
    materialName: string,
    uniformName: string,
    uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D",
    value: number | number[] | any
  ) {
    if (!MaterialManager) {
      console.error(
        "ViroMaterials: MaterialManager is not available for uniform update"
      );
      return;
    }
    MaterialManager.updateShaderUniform(
      materialName,
      uniformName,
      uniformType,
      value
    );
  }
}
