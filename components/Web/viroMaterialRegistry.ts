/**
 * Web material registry. On native, ViroMaterials.createMaterials() pushes
 * definitions into the VRTMaterialManager native module. On web there is no
 * native module, so ViroMaterials.web stores definitions here, and node
 * components resolve them by name to build materials through the C API.
 *
 * Supports color, lighting model, scalar properties (shininess/fresnel/
 * roughness/metalness/cull/blend/depth), and textures (diffuse + PBR maps).
 * Textures load asynchronously and are applied when ready.
 */
import type { ViroSceneApi, ViroHandle } from "@reactvision/viro-web-renderer";
import {
  ViroLightingModel,
  ViroCullMode,
  ViroBlendMode,
  ViroWrapMode,
  ViroFilterMode,
  ViroTextureChannel,
} from "@reactvision/viro-web-renderer";
import { parseColorToRGBA } from "./viroColor";
import { loadImageRGBA, resolveImageSource } from "./viroImageLoader";

export interface ViroWebMaterialDef {
  diffuseColor?: string | number;
  lightingModel?: string;
  [key: string]: unknown;
}

const registry = new Map<string, ViroWebMaterialDef>();
// One material handle per name (shared, like native): lets geometries and
// ViroMaterialVideo reference the same material. Cleared on renderer teardown.
const handleCache = new Map<string, ViroHandle>();

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

/** Drop cached material handles (call when the renderer/module is disposed). */
export function resetMaterialCache(): void {
  handleCache.clear();
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

function cullModeValue(mode?: string): ViroCullMode | undefined {
  switch (mode) {
    case "None": return ViroCullMode.None;
    case "Front": return ViroCullMode.Front;
    case "Back": return ViroCullMode.Back;
    default: return undefined;
  }
}

function blendModeValue(mode?: string): ViroBlendMode | undefined {
  switch (mode) {
    case "None": return ViroBlendMode.None;
    case "Alpha": return ViroBlendMode.Alpha;
    case "Add": return ViroBlendMode.Add;
    case "Subtract": return ViroBlendMode.Subtract;
    case "Multiply": return ViroBlendMode.Multiply;
    case "Screen": return ViroBlendMode.Screen;
    default: return undefined;
  }
}

function wrapValue(mode?: string): ViroWrapMode {
  switch (mode) {
    case "Repeat": return ViroWrapMode.Repeat;
    case "Mirror": return ViroWrapMode.Mirror;
    default: return ViroWrapMode.Clamp;
  }
}

function filterValue(mode?: string): ViroFilterMode {
  return mode === "Nearest" ? ViroFilterMode.Nearest : ViroFilterMode.Linear;
}

// Texture channels: (material def key, C API channel, is-color/sRGB).
const TEXTURE_CHANNELS: Array<[string, ViroTextureChannel, boolean]> = [
  ["diffuseTexture", ViroTextureChannel.Diffuse, true],
  ["specularTexture", ViroTextureChannel.Specular, false],
  ["normalTexture", ViroTextureChannel.Normal, false],
  ["roughnessTexture", ViroTextureChannel.Roughness, false],
  ["metalnessTexture", ViroTextureChannel.Metalness, false],
  ["ambientOcclusionTexture", ViroTextureChannel.AmbientOcclusion, false],
];

function applyTextures(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  const wrapS = wrapValue(def.wrapS as string | undefined);
  const wrapT = wrapValue(def.wrapT as string | undefined);
  const minF = filterValue(def.minificationFilter as string | undefined);
  const magF = filterValue(def.magnificationFilter as string | undefined);
  const mipF = filterValue(def.mipFilter as string | undefined);

  for (const [key, channel, sRGB] of TEXTURE_CHANNELS) {
    const url = resolveImageSource(def[key]);
    if (!url) continue;
    loadImageRGBA(url)
      .then((img) => {
        const tex = scene.createTextureRGBA(img.pixels, img.width, img.height, sRGB);
        scene.setTextureWrap(tex, wrapS, wrapT);
        scene.setTextureFilter(tex, minF, magF, mipF);
        scene.setMaterialTexture(material, channel, tex);
      })
      .catch((err) => console.warn(`[Viro web] texture "${key}" failed:`, err));
  }
}

/**
 * Build a native material from a registered definition and return its handle,
 * or 0 if the name isn't registered. Textures apply asynchronously.
 */
export function createMaterialFromRegistry(
  scene: ViroSceneApi,
  name: string,
): ViroHandle {
  // Return the shared handle if this material was already built (named materials
  // are shared, so ViroMaterialVideo can update the diffuse across all users).
  const cached = handleCache.get(name);
  if (cached) return cached;

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

  // Scalar properties.
  if (typeof def.shininess === "number") scene.setMaterialShininess(material, def.shininess);
  if (typeof def.fresnelExponent === "number") scene.setMaterialFresnelExponent(material, def.fresnelExponent);
  if (typeof def.roughness === "number") scene.setMaterialRoughness(material, def.roughness);
  if (typeof def.metalness === "number") scene.setMaterialMetalness(material, def.metalness);
  if (typeof def.diffuseIntensity === "number") scene.setMaterialDiffuseIntensity(material, def.diffuseIntensity);
  if (typeof def.writesToDepthBuffer === "boolean") scene.setMaterialWritesToDepthBuffer(material, def.writesToDepthBuffer);
  if (typeof def.readsFromDepthBuffer === "boolean") scene.setMaterialReadsFromDepthBuffer(material, def.readsFromDepthBuffer);
  const cull = cullModeValue(def.cullMode as string | undefined);
  if (cull !== undefined) scene.setMaterialCullMode(material, cull);
  const blend = blendModeValue(def.blendMode as string | undefined);
  if (blend !== undefined) scene.setMaterialBlendMode(material, blend);

  applyTextures(scene, material, def);
  handleCache.set(name, material);
  return material;
}

/**
 * Get (creating if needed) the shared material handle for a registered name.
 * Used by ViroMaterialVideo to drive video frames onto a named material.
 */
export function getSharedMaterialHandle(scene: ViroSceneApi, name: string): ViroHandle {
  return createMaterialFromRegistry(scene, name);
}
