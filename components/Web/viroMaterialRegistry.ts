/**
 * Web material registry. On native, ViroMaterials.createMaterials() pushes
 * definitions into the VRTMaterialManager native module. On web there is no
 * native module, so ViroMaterials.web stores definitions here, and node
 * components resolve them by name to build materials through the C API.
 *
 * MVP scope: diffuseColor + lightingModel. Textures/PBR maps are follow-ups.
 */
import type { ViroSceneApi, ViroHandle } from "@reactvision/viro-web-renderer";
import { ViroLightingModel } from "@reactvision/viro-web-renderer";
import { parseColorToRGBA } from "./viroColor";

export interface ViroWebMaterialDef {
  diffuseColor?: string | number;
  lightingModel?: string;
  [key: string]: unknown;
}

const registry = new Map<string, ViroWebMaterialDef>();

export function registerViroMaterials(
  materials: Record<string, ViroWebMaterialDef>,
): void {
  for (const name of Object.keys(materials)) {
    registry.set(name, materials[name]);
  }
}

export function getViroMaterialDef(name: string): ViroWebMaterialDef | undefined {
  return registry.get(name);
}

function lightingModelValue(model?: string): ViroLightingModel {
  switch (model) {
    case "Constant": return ViroLightingModel.Constant;
    case "Lambert": return ViroLightingModel.Lambert;
    case "Phong": return ViroLightingModel.Phong;
    case "PBR":
    case "PhysicallyBased": return ViroLightingModel.PhysicallyBased;
    case "Blinn":
    default: return ViroLightingModel.Blinn;
  }
}

/**
 * Build a native material from a registered definition and return its handle,
 * or 0 if the name isn't registered.
 */
export function createMaterialFromRegistry(
  scene: ViroSceneApi,
  name: string,
): ViroHandle {
  const def = registry.get(name);
  if (!def) {
    console.warn(`[Viro web] material "${name}" is not registered`);
    return 0;
  }
  const material = scene.createMaterial();
  scene.setMaterialLightingModel(material, lightingModelValue(def.lightingModel));
  if (def.diffuseColor !== undefined) {
    const [r, g, b, a] = parseColorToRGBA(def.diffuseColor);
    scene.setMaterialDiffuseColor(material, r, g, b, a);
  }
  return material;
}
