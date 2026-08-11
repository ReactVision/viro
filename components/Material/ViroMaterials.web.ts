/**
 * Web implementation of ViroMaterials. Instead of pushing material definitions
 * to the native VRTMaterialManager, it stores them in the web material registry,
 * where node components resolve them by name and build materials via the C API.
 *
 * Supports diffuseColor, lightingModel, scalar properties, PBR textures,
 * shaderModifiers, and updateShaderUniform (parsed/dispatched the same way as
 * MaterialManager.java's native bridge — see viroMaterialRegistry.ts).
 */
import { registerViroMaterials, updateMaterialShaderUniform } from "../Web/viroMaterialRegistry";

// Type-only re-exports (erased at compile time — no native module import).
export type {
  ViroMaterial,
  ViroMaterialDict,
  ViroCubeMap,
  ViroResolvedCubeMap,
  ViroShaderModifier,
  ViroShaderModifiers,
  ViroShaderUniform,
  ViroSemanticLabel,
  ViroSemanticMaskConfig,
  ViroSemanticMaskMode,
} from "./ViroMaterials";

export class ViroMaterials {
  static createMaterials(materials: Record<string, any>) {
    registerViroMaterials(materials);
  }

  // Not yet implemented on web; accepted as a no-op so shared code doesn't break.
  static deleteMaterials(_materials: any) {}

  static updateShaderUniform(
    materialName: string,
    uniformName: string,
    uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D",
    value: number | number[] | any,
  ) {
    updateMaterialShaderUniform(materialName, uniformName, uniformType, value);
  }
}
