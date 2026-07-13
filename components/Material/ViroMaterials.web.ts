/**
 * Web implementation of ViroMaterials. Instead of pushing material definitions
 * to the native VRTMaterialManager, it stores them in the web material registry,
 * where node components resolve them by name and build materials via the C API.
 *
 * MVP scope: diffuseColor + lightingModel. Textures/PBR maps/shader modifiers
 * are accepted but currently ignored on web.
 */
import { registerViroMaterials } from "../Web/viroMaterialRegistry";

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

  // Not yet implemented on web; accepted as no-ops so shared code doesn't break.
  static deleteMaterials(_materials: any) {}
  static updateShaderUniform(_material: any, _uniform: any, _value: any) {}
}
