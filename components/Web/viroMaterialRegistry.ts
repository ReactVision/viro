/**
 * Web material registry. On native, ViroMaterials.createMaterials() pushes
 * definitions into the VRTMaterialManager native module. On web there is no
 * native module, so ViroMaterials.web stores definitions here, and node
 * components resolve them by name to build materials through the C API.
 *
 * Supports color, lighting model, scalar properties (shininess/fresnel/
 * roughness/metalness/cull/blend/depth/alpha/bloom), colour write mask, chroma
 * key, emission colour, and textures (diffuse, PBR maps, emission and the
 * reflective cube map).
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
import { warnUnsupported } from "../Utilities/ViroUnsupported";
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

/**
 * ViroMaterials.deleteMaterials's web backend. Mirrors MaterialManager.java's
 * deleteMaterials: for each name, if it was already built, destroy its native
 * handle before dropping it; either way, drop the definition so a later
 * createMaterials() for the same name starts clean.
 */
export function deleteViroMaterials(materialNames: string[]): void {
  for (const name of materialNames) {
    const handle = handleCache.get(name);
    if (handle) {
      lastScene?.destroyMaterial(handle);
      handleCache.delete(name);
    }
    registry.delete(name);
  }
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

// VROColorMask's bits. Not ViroColorWriteMask, which renderer 1.1.1 does not export.
const COLOR_WRITE_MASKS: Record<string, number> = { none: 0, red: 1, green: 2, blue: 4, alpha: 8, all: 15 };

// Names are ORed together, case-insensitively, as VRTMaterialManager reads them.
function colorWriteMaskValue(names: unknown): number | undefined {
  if (!Array.isArray(names)) return undefined;
  return names.reduce<number>((mask, name) => mask | (COLOR_WRITE_MASKS[String(name).toLowerCase()] ?? 0), 0);
}

// Alpha, bloom threshold, colour write mask and chroma key, which renderer
// 1.1.1 and earlier cannot set.
function applyEffects(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  const alpha = typeof def.alpha === "number" ? def.alpha : undefined;
  const bloom = typeof def.bloomThreshold === "number" ? def.bloomThreshold : undefined;
  const mask = colorWriteMaskValue(def.colorWriteMask);
  const chroma = def.chromaKeyFilteringColor as string | number | null | undefined;
  if (alpha === undefined && bloom === undefined && mask === undefined && chroma == null) return;
  if (typeof scene.setMaterialAlpha !== "function" || scene.supportsMaterialEffects === false) {
    // Native's defaults would draw the same, so only a value that differs is worth a warning.
    const differs = (alpha ?? 1) < 1 || (bloom ?? -1) >= 0 || (mask ?? 15) !== 15 || chroma != null;
    if (differs) warnUnsupported(
      "Material alpha, bloomThreshold, colorWriteMask and chromaKeyFilteringColor",
      "this build of the web renderer",
      "Update @reactvision/viro-web-renderer.",
    );
    return;
  }
  if (alpha !== undefined) {
    scene.setMaterialAlpha(material, alpha);
    // As on native: a translucent material that still writes depth hides its own far faces.
    if (alpha < 1 && typeof def.writesToDepthBuffer !== "boolean") {
      scene.setMaterialWritesToDepthBuffer(material, false);
    }
  }
  if (bloom !== undefined) scene.setMaterialBloomThreshold(material, bloom);
  if (mask !== undefined) scene.setMaterialColorWriteMask(material, mask);
  if (chroma != null) {
    const [r, g, b] = parseColorToRGBA(chroma);
    scene.setMaterialChromaKey(material, { r, g, b });
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

function applyTexture(
  scene: ViroSceneApi,
  material: ViroHandle,
  def: ViroWebMaterialDef,
  key: string,
  channel: ViroTextureChannel,
  sRGB: boolean,
) {
  const url = resolveImageSource(def[key]);
  if (!url) return;
  loadImageRGBA(url)
    .then((img) => {
      const tex = scene.createTextureRGBA(img.pixels, img.width, img.height, sRGB);
      scene.setTextureWrap(tex, wrapValue(def.wrapS as string | undefined), wrapValue(def.wrapT as string | undefined));
      scene.setTextureFilter(
        tex,
        filterValue(def.minificationFilter as string | undefined),
        filterValue(def.magnificationFilter as string | undefined),
        filterValue(def.mipFilter as string | undefined),
      );
      scene.setMaterialTexture(material, channel, tex);
    })
    .catch((err) => console.warn(`[Viro web] texture "${key}" failed:`, err));
}

function applyTextures(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  for (const [key, channel, sRGB] of TEXTURE_CHANNELS) applyTexture(scene, material, def, key, channel, sRGB);
}

const CUBE_FACES = ["px", "nx", "py", "ny", "pz", "nz"] as const;

// Emission and the reflective cube map, which renderer 1.3.0 and earlier cannot set.
function applyEmissionAndReflection(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  const emission = def.emissionColor as string | number | null | undefined;
  const cube = def.reflectiveTexture as Record<string, unknown> | null | undefined;
  const faceUrls = cube ? CUBE_FACES.map((face) => resolveImageSource(cube[face])) : [];
  const reflective = faceUrls.length > 0 && faceUrls.every(Boolean);
  if (emission == null && !resolveImageSource(def.emissionTexture) && !reflective) return;
  if (typeof scene.setMaterialEmissionColor !== "function" || !scene.supportsEmissionAndReflection) {
    warnUnsupported(
      "Material emissionColor, emissionTexture and reflectiveTexture",
      "this build of the web renderer",
      "Update @reactvision/viro-web-renderer.",
    );
    return;
  }
  if (emission != null) {
    const [r, g, b] = parseColorToRGBA(emission);
    scene.setMaterialEmissionColor(material, r, g, b);
  }
  // Linear, as iOS and Android load it (only diffuse is sRGB there).
  applyTexture(scene, material, def, "emissionTexture", ViroTextureChannel.Emission, false);
  if (!reflective) return;
  Promise.all(faceUrls.map((url) => loadImageRGBA(url as string)))
    .then((faces) => {
      const [px, nx, py, ny, pz, nz] = faces.map((face) => face.pixels);
      const tex = scene.createTextureCubeRGBA({ px, nx, py, ny, pz, nz }, faces[0].width, faces[0].height);
      scene.setMaterialTexture(material, ViroTextureChannel.Reflective, tex);
    })
    .catch((err) => console.warn(`[Viro web] texture "reflectiveTexture" failed:`, err));
}

type ViroUniformType = "float" | "vec2" | "vec3" | "vec4" | "mat4" | "sampler2D";

function setMaterialUniform(
  scene: ViroSceneApi,
  material: ViroHandle,
  uniformName: string,
  uniformType: ViroUniformType,
  value: unknown,
): void {
  switch (uniformType) {
    case "float": {
      const n = Number(value);
      if (Number.isNaN(n)) {
        console.warn(`[Viro web] shader uniform: "float" value for "${uniformName}" is not a number`);
        break;
      }
      scene.setMaterialShaderUniformFloat(material, uniformName, n);
      break;
    }
    case "vec2": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length < 2 || v.slice(0, 2).some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] shader uniform: "vec2" value for "${uniformName}" must be a 2-element number array`);
        break;
      }
      scene.setMaterialShaderUniformVec2(material, uniformName, v[0]!, v[1]!);
      break;
    }
    case "vec3": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length < 3 || v.slice(0, 3).some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] shader uniform: "vec3" value for "${uniformName}" must be a 3-element number array`);
        break;
      }
      scene.setMaterialShaderUniformVec3(material, uniformName, v[0]!, v[1]!, v[2]!);
      break;
    }
    case "vec4": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length < 4 || v.slice(0, 4).some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] shader uniform: "vec4" value for "${uniformName}" must be a 4-element number array`);
        break;
      }
      scene.setMaterialShaderUniformVec4(material, uniformName, v[0]!, v[1]!, v[2]!, v[3]!);
      break;
    }
    case "mat4": {
      const v = value as number[];
      if (!Array.isArray(v) || v.length !== 16 || v.some((n) => typeof n !== "number")) {
        console.warn(`[Viro web] shader uniform: "mat4" value for "${uniformName}" must be a 16-element number array`);
        break;
      }
      scene.setMaterialShaderUniformMat4(material, uniformName, v);
      break;
    }
    case "sampler2D": {
      const url = resolveImageSource(value);
      if (!url) {
        console.warn(`[Viro web] shader uniform: couldn't resolve an image source for sampler2D "${uniformName}"`);
        break;
      }
      loadImageRGBA(url)
        .then((img) => {
          const tex = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
          scene.setMaterialShaderUniformTexture(material, uniformName, tex);
        })
        .catch((err) => console.warn(`[Viro web] shader uniform: sampler2D "${uniformName}" failed:`, err));
      break;
    }
    default:
      console.warn(`[Viro web] shader uniform: uniformType "${uniformType}" isn't supported on any platform (no VROMaterial uniform map for it)`);
      break;
  }
}

// A material's own uniforms, as the native managers read them at creation:
// `materialUniforms` or `shaderUniforms`, a [{name, type, value}] list or a
// {name: {type, value}} map.
function applyUniforms(scene: ViroSceneApi, material: ViroHandle, def: ViroWebMaterialDef) {
  for (const key of ["materialUniforms", "shaderUniforms"]) {
    const uniforms = def[key];
    const entries = Array.isArray(uniforms)
      ? uniforms.map((u) => [u?.name, u] as const)
      : uniforms && typeof uniforms === "object"
        ? Object.entries(uniforms as Record<string, unknown>)
        : [];
    for (const [name, u] of entries) {
      const uniform = u as { type?: ViroUniformType; value?: unknown } | null;
      if (typeof name !== "string" || !uniform?.type || uniform.value === undefined) continue;
      setMaterialUniform(scene, material, name, uniform.type, uniform.value);
    }
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
  const material = buildMaterial(scene, def);
  handleCache.set(name, material);
  return material;
}

/**
 * Every name in a materials prop, as native applies it: a box with six takes
 * one per face and a ViroGeometry one per submesh. A renderer without the
 * array setter (1.2.0), or a name that is not registered, leaves the first
 * one alone, as before. False when not even that applied.
 */
export function applyRegistryMaterials(scene: ViroSceneApi, geometry: ViroHandle, names: string[]): boolean {
  if (names.length > 1 && typeof scene.setGeometryMaterials === "function") {
    const handles = names.map((name) => createMaterialFromRegistry(scene, name));
    if (handles.every(Boolean) && scene.setGeometryMaterials(geometry, handles)) return true;
  }
  const first = names[0] ? createMaterialFromRegistry(scene, names[0]) : 0;
  if (first) scene.setGeometryMaterial(geometry, first);
  return !!first;
}

// VROARShadow.cpp, verbatim: the surface draws black at the strength of the
// shadow falling on it, less the ambient light, and nothing elsewhere.
const AR_SHADOW_MODIFIERS: [ViroShaderEntryPoint, string][] = [
  ["surface", "highp float totalShadow = 0.0;"],
  ["lightingModel", "totalShadow += (1.0 - _lightingContribution.visibility);"],
  [
    "fragment",
    [
      "if (totalShadow != 0.0) {",
      "    highp float ambient_brightness = dot(_ambient.rgb, vec3(0.2126, 0.7152, 0.0722));",
      "    _output_color = vec4(0, 0, 0, max(min(1.0, totalShadow) - ambient_brightness, 0.0));",
      "} else {",
      "    _output_color = vec4(0, 0, 0, 0);",
      "}",
    ].join("\n"),
  ],
];

/**
 * VROARShadow::apply on a node's own material (arShadowReceiver). Native also
 * stops the material casting shadows; the web API has no setter for that.
 */
export function applyARShadow(scene: ViroSceneApi, material: ViroHandle) {
  // PBR so the ambient term includes irradiance, as native chooses.
  scene.setMaterialLightingModel(material, ViroLightingModel.PhysicallyBased);
  scene.setMaterialWritesToDepthBuffer(material, false);
  for (const [entryPoint, code] of AR_SHADOW_MODIFIERS) scene.addMaterialShaderModifier(material, entryPoint, code);
}

/**
 * A material for one node alone, built like the shared one for `name` (or
 * virocore's default without a name), so animating its colour does not
 * recolour every node that shares the name. The caller destroys it.
 */
export function createOwnMaterial(scene: ViroSceneApi, name?: string): ViroHandle {
  const def = name ? registry.get(name) : undefined;
  return def ? buildMaterial(scene, def) : scene.createMaterial();
}

/**
 * What native's `material` animation carries from material `name` onto a
 * node's own: the diffuse texture if it has one, else the diffuse colour
 * (animated when called inside a transaction), and the lighting model. The
 * other properties native copies are copied where `name` sets them.
 */
export function applyMaterialAnimationTarget(scene: ViroSceneApi, material: ViroHandle, name: string): boolean {
  const def = registry.get(name);
  if (!def) return false;
  if (resolveImageSource(def.diffuseTexture)) {
    applyTextures(scene, material, { diffuseTexture: def.diffuseTexture, wrapS: def.wrapS, wrapT: def.wrapT } as ViroWebMaterialDef);
  } else {
    const [r, g, b, a] = parseColorToRGBA(def.diffuseColor ?? "#ffffff");
    scene.setMaterialDiffuseColor(material, r, g, b, a);
  }
  scene.setMaterialLightingModel(material, lightingModelValue(def.lightingModel));
  if (typeof def.shininess === "number") scene.setMaterialShininess(material, def.shininess);
  if (typeof def.fresnelExponent === "number") scene.setMaterialFresnelExponent(material, def.fresnelExponent);
  const cull = cullModeValue(def.cullMode as string | undefined);
  if (cull !== undefined) scene.setMaterialCullMode(material, cull);
  if (typeof def.writesToDepthBuffer === "boolean") scene.setMaterialWritesToDepthBuffer(material, def.writesToDepthBuffer);
  if (typeof def.readsFromDepthBuffer === "boolean") scene.setMaterialReadsFromDepthBuffer(material, def.readsFromDepthBuffer);
  return true;
}

function buildMaterial(scene: ViroSceneApi, def: ViroWebMaterialDef): ViroHandle {
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
  // Call a setter only for a key the definition names: the wasm records each
  // call as authored, and merging a shader override onto a model copies only
  // those, as native does. No transparencyMode: the C API has no setter, and
  // nothing in virocore reads the mode.
  const cull = cullModeValue(def.cullMode as string | undefined);
  if (cull !== undefined) scene.setMaterialCullMode(material, cull);
  const blend = blendModeValue(def.blendMode as string | undefined);
  if (blend !== undefined) scene.setMaterialBlendMode(material, blend);
  applyEffects(scene, material, def);

  applyTextures(scene, material, def);
  applyEmissionAndReflection(scene, material, def);
  applyShaderModifiers(scene, material, def);
  applyUniforms(scene, material, def);
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
 * "vec2" is a web-only superset today: the native Android/iOS bridges don't
 * expose it (their RN methods have no vec2 branch), but the underlying engine
 * (VROMaterial) now has a real vec2 uniform map, added for this. Values
 * written here won't do anything on native until those bridges add a
 * matching branch.
 */
export function updateMaterialShaderUniform(
  materialName: string,
  uniformName: string,
  uniformType: ViroUniformType,
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

  setMaterialUniform(scene, material, uniformName, uniformType, value);
}
