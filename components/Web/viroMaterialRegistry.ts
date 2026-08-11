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
import type { ViroSceneApi, ViroHandle, ViroShaderEntryPoint } from "@reactvision/viro-web-renderer";
import {
  ViroLightingModel,
  ViroCullMode,
  ViroBlendMode,
  ViroWrapMode,
  ViroFilterMode,
  ViroTextureChannel,
} from "@reactvision/viro-web-renderer";
import type { ViroShaderModifier, ViroShaderModifiers } from "../Material/ViroMaterials";
import { parseColorToRGBA } from "./viroColor";
import { loadImageRGBA, resolveImageSource } from "./viroImageLoader";

export interface ViroWebMaterialDef {
  diffuseColor?: string | number;
  lightingModel?: string;
  shaderModifiers?: ViroShaderModifiers;
  [key: string]: unknown;
}

const registry = new Map<string, ViroWebMaterialDef>();
// One material handle per name (shared, like native): lets geometries and
// ViroMaterialVideo reference the same material. Cleared on renderer teardown.
const handleCache = new Map<string, ViroHandle>();
// ViroMaterials.updateShaderUniform is a static, scene-less call (mirrors the
// native bridges' static material registry) — track the scene a material was
// last built against so it can be resolved without one being passed in.
let lastScene: ViroSceneApi | null = null;

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
  lastScene = null;
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

// Mirrors MaterialManager.java::parseShaderModifiers: each key of the
// shaderModifiers dict is a shader entry point, whose value is either the
// modifier body directly (string form) or a dict with body/uniforms/varyings/
// requiresSceneDepth/requiresCameraTexture. uniforms + body are concatenated
// with a newline into the single blob the C API expects, same as native.
function applyShaderModifiers(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  const modifiers = def.shaderModifiers;
  if (!modifiers) return;

  for (const entryPoint of Object.keys(modifiers) as Array<keyof ViroShaderModifiers>) {
    const entry = modifiers[entryPoint];
    if (entry === undefined) continue;

    let code: string | undefined;
    let varyings: string[] | undefined;
    let requiresSceneDepth = false;
    let requiresCameraTexture = false;

    if (typeof entry === "string") {
      code = entry;
    } else {
      const dict = entry as ViroShaderModifier;
      code = dict.uniforms ? `${dict.uniforms}\n${dict.body ?? ""}` : dict.body;
      varyings = dict.varyings;
      requiresSceneDepth = dict.requiresSceneDepth ?? false;
      requiresCameraTexture = dict.requiresCameraTexture ?? false;
    }

    if (!code) continue;
    scene.addMaterialShaderModifier(
      material,
      entryPoint as ViroShaderEntryPoint,
      code,
      varyings,
      requiresSceneDepth,
      requiresCameraTexture,
    );
  }
}

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
  lastScene = scene;

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
  applyShaderModifiers(scene, material, def);
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

/**
 * ViroMaterials.updateShaderUniform's web backend. Mirrors
 * MaterialManager.java::updateShaderUniform: resolve the material by name,
 * dispatch on uniformType. Requires the uniform to be declared in a
 * shaderModifier already attached to the material (see applyShaderModifiers)
 * — the value has nowhere to go otherwise, same as native.
 *
 * "vec2" is accepted (matches the JS-facing type union) but a no-op: neither
 * native bridge exposes it either, because VROMaterial itself has no vec2
 * uniform map at the engine level — a real gap, not a web-only omission.
 */
export function updateMaterialShaderUniform(
  materialName: string,
  uniformName: string,
  uniformType: "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D",
  value: unknown,
): void {
  const material = handleCache.get(materialName);
  if (!material) {
    console.warn(`[Viro web] updateShaderUniform: material "${materialName}" hasn't been built yet (no node uses it)`);
    return;
  }
  const scene = lastScene;
  if (!scene) {
    console.warn(`[Viro web] updateShaderUniform: no active scene to update "${materialName}" on`);
    return;
  }

  switch (uniformType) {
    case "float": {
      const n = Number(value);
      if (Number.isNaN(n)) {
        console.warn(`[Viro web] updateShaderUniform: "float" value for "${uniformName}" is not a number`);
        break;
      }
      scene.setMaterialShaderUniformFloat(material, uniformName, n);
      break;
    }
    case "vec3": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length < 3 || v.slice(0, 3).some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] updateShaderUniform: "vec3" value for "${uniformName}" must be a 3-element number array`);
        break;
      }
      scene.setMaterialShaderUniformVec3(material, uniformName, v[0]!, v[1]!, v[2]!);
      break;
    }
    case "vec4": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length < 4 || v.slice(0, 4).some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] updateShaderUniform: "vec4" value for "${uniformName}" must be a 4-element number array`);
        break;
      }
      scene.setMaterialShaderUniformVec4(material, uniformName, v[0]!, v[1]!, v[2]!, v[3]!);
      break;
    }
    case "mat4": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length !== 16 || v.some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] updateShaderUniform: "mat4" value for "${uniformName}" must be a 16-element number array`);
        break;
      }
      scene.setMaterialShaderUniformMat4(material, uniformName, v);
      break;
    }
    case "sampler2D": {
      const url = resolveImageSource(value);
      if (!url) {
        console.warn(`[Viro web] updateShaderUniform: couldn't resolve an image source for sampler2D "${uniformName}"`);
        break;
      }
      loadImageRGBA(url)
        .then((img) => {
          const tex = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
          scene.setMaterialShaderUniformTexture(material, uniformName, tex);
        })
        .catch((err) => console.warn(`[Viro web] updateShaderUniform: sampler2D "${uniformName}" failed:`, err));
      break;
    }
    default:
      console.warn(`[Viro web] updateShaderUniform: uniformType "${uniformType}" isn't supported on any platform (no VROMaterial uniform map for it)`);
      break;
  }
}
