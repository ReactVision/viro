"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerViroMaterials = registerViroMaterials;
exports.getViroMaterialDef = getViroMaterialDef;
exports.deleteViroMaterials = deleteViroMaterials;
exports.resetMaterialCache = resetMaterialCache;
exports.createMaterialFromRegistry = createMaterialFromRegistry;
exports.getSharedMaterialHandle = getSharedMaterialHandle;
exports.updateMaterialShaderUniform = updateMaterialShaderUniform;
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const viroColor_1 = require("./viroColor");
const viroImageLoader_1 = require("./viroImageLoader");
const registry = new Map();
// One material handle per name (shared, like native): lets geometries and
// ViroMaterialVideo reference the same material. Cleared on renderer teardown.
const handleCache = new Map();
// ViroMaterials.updateShaderUniform is a static, scene-less call (mirrors the
// native bridges' static material registry) — track the scene a material was
// last built against so it can be resolved without one being passed in.
let lastScene = null;
function registerViroMaterials(materials) {
    for (const name of Object.keys(materials)) {
        registry.set(name, materials[name]);
    }
}
function getViroMaterialDef(name) {
    return registry.get(name);
}
/**
 * ViroMaterials.deleteMaterials's web backend. Mirrors MaterialManager.java's
 * deleteMaterials: for each name, if it was already built, destroy its native
 * handle before dropping it; either way, drop the definition so a later
 * createMaterials() for the same name starts clean.
 */
function deleteViroMaterials(materialNames) {
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
function resetMaterialCache() {
    handleCache.clear();
    lastScene = null;
}
function lightingModelValue(model) {
    switch (model) {
        case "Constant": return viro_web_renderer_1.ViroLightingModel.Constant;
        case "Lambert": return viro_web_renderer_1.ViroLightingModel.Lambert;
        case "Phong": return viro_web_renderer_1.ViroLightingModel.Phong;
        case "PBR":
        case "PhysicallyBased": return viro_web_renderer_1.ViroLightingModel.PhysicallyBased;
        case "Blinn":
        default: return viro_web_renderer_1.ViroLightingModel.Blinn;
    }
}
function cullModeValue(mode) {
    switch (mode) {
        case "None": return viro_web_renderer_1.ViroCullMode.None;
        case "Front": return viro_web_renderer_1.ViroCullMode.Front;
        case "Back": return viro_web_renderer_1.ViroCullMode.Back;
        default: return undefined;
    }
}
function blendModeValue(mode) {
    switch (mode) {
        case "None": return viro_web_renderer_1.ViroBlendMode.None;
        case "Alpha": return viro_web_renderer_1.ViroBlendMode.Alpha;
        case "Add": return viro_web_renderer_1.ViroBlendMode.Add;
        case "Subtract": return viro_web_renderer_1.ViroBlendMode.Subtract;
        case "Multiply": return viro_web_renderer_1.ViroBlendMode.Multiply;
        case "Screen": return viro_web_renderer_1.ViroBlendMode.Screen;
        default: return undefined;
    }
}
function wrapValue(mode) {
    switch (mode) {
        case "Repeat": return viro_web_renderer_1.ViroWrapMode.Repeat;
        case "Mirror": return viro_web_renderer_1.ViroWrapMode.Mirror;
        default: return viro_web_renderer_1.ViroWrapMode.Clamp;
    }
}
function filterValue(mode) {
    return mode === "Nearest" ? viro_web_renderer_1.ViroFilterMode.Nearest : viro_web_renderer_1.ViroFilterMode.Linear;
}
// Texture channels: (material def key, C API channel, is-color/sRGB).
const TEXTURE_CHANNELS = [
    ["diffuseTexture", viro_web_renderer_1.ViroTextureChannel.Diffuse, true],
    ["specularTexture", viro_web_renderer_1.ViroTextureChannel.Specular, false],
    ["normalTexture", viro_web_renderer_1.ViroTextureChannel.Normal, false],
    ["roughnessTexture", viro_web_renderer_1.ViroTextureChannel.Roughness, false],
    ["metalnessTexture", viro_web_renderer_1.ViroTextureChannel.Metalness, false],
    ["ambientOcclusionTexture", viro_web_renderer_1.ViroTextureChannel.AmbientOcclusion, false],
];
// Mirrors MaterialManager.java::parseShaderModifiers: each key of the
// shaderModifiers dict is a shader entry point, whose value is either the
// modifier body directly (string form) or a dict with body/uniforms/varyings/
// requiresSceneDepth/requiresCameraTexture. uniforms + body are concatenated
// with a newline into the single blob the C API expects, same as native.
function applyShaderModifiers(scene, material, def) {
    const modifiers = def.shaderModifiers;
    if (!modifiers)
        return;
    for (const entryPoint of Object.keys(modifiers)) {
        const entry = modifiers[entryPoint];
        if (entry === undefined)
            continue;
        let code;
        let varyings;
        let requiresSceneDepth = false;
        let requiresCameraTexture = false;
        if (typeof entry === "string") {
            code = entry;
        }
        else {
            const dict = entry;
            code = dict.uniforms ? `${dict.uniforms}\n${dict.body ?? ""}` : dict.body;
            varyings = dict.varyings;
            requiresSceneDepth = dict.requiresSceneDepth ?? false;
            requiresCameraTexture = dict.requiresCameraTexture ?? false;
        }
        if (!code)
            continue;
        scene.addMaterialShaderModifier(material, entryPoint, code, varyings, requiresSceneDepth, requiresCameraTexture);
    }
}
function applyTextures(scene, material, def) {
    const wrapS = wrapValue(def.wrapS);
    const wrapT = wrapValue(def.wrapT);
    const minF = filterValue(def.minificationFilter);
    const magF = filterValue(def.magnificationFilter);
    const mipF = filterValue(def.mipFilter);
    for (const [key, channel, sRGB] of TEXTURE_CHANNELS) {
        const url = (0, viroImageLoader_1.resolveImageSource)(def[key]);
        if (!url)
            continue;
        (0, viroImageLoader_1.loadImageRGBA)(url)
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
function createMaterialFromRegistry(scene, name) {
    lastScene = scene;
    // Return the shared handle if this material was already built (named materials
    // are shared, so ViroMaterialVideo can update the diffuse across all users).
    const cached = handleCache.get(name);
    if (cached)
        return cached;
    const def = registry.get(name);
    if (!def) {
        console.warn(`[Viro web] material "${name}" is not registered`);
        return 0;
    }
    const material = scene.createMaterial();
    scene.setMaterialLightingModel(material, lightingModelValue(def.lightingModel));
    if (def.diffuseColor !== undefined) {
        const [r, g, b, a] = (0, viroColor_1.parseColorToRGBA)(def.diffuseColor);
        scene.setMaterialDiffuseColor(material, r, g, b, a);
    }
    // Scalar properties.
    if (typeof def.shininess === "number")
        scene.setMaterialShininess(material, def.shininess);
    if (typeof def.fresnelExponent === "number")
        scene.setMaterialFresnelExponent(material, def.fresnelExponent);
    if (typeof def.roughness === "number")
        scene.setMaterialRoughness(material, def.roughness);
    if (typeof def.metalness === "number")
        scene.setMaterialMetalness(material, def.metalness);
    if (typeof def.diffuseIntensity === "number")
        scene.setMaterialDiffuseIntensity(material, def.diffuseIntensity);
    if (typeof def.writesToDepthBuffer === "boolean")
        scene.setMaterialWritesToDepthBuffer(material, def.writesToDepthBuffer);
    if (typeof def.readsFromDepthBuffer === "boolean")
        scene.setMaterialReadsFromDepthBuffer(material, def.readsFromDepthBuffer);
    const cull = cullModeValue(def.cullMode);
    if (cull !== undefined)
        scene.setMaterialCullMode(material, cull);
    const blend = blendModeValue(def.blendMode);
    if (blend !== undefined)
        scene.setMaterialBlendMode(material, blend);
    applyTextures(scene, material, def);
    applyShaderModifiers(scene, material, def);
    handleCache.set(name, material);
    return material;
}
/**
 * Get (creating if needed) the shared material handle for a registered name.
 * Used by ViroMaterialVideo to drive video frames onto a named material.
 */
function getSharedMaterialHandle(scene, name) {
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
function updateMaterialShaderUniform(materialName, uniformName, uniformType, value) {
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
        case "vec2": {
            const v = value;
            if (!Array.isArray(v) || v.length < 2 || v.slice(0, 2).some((n) => typeof n !== "number")) {
                console.warn(`[Viro web] updateShaderUniform: "vec2" value for "${uniformName}" must be a 2-element number array`);
                break;
            }
            scene.setMaterialShaderUniformVec2(material, uniformName, v[0], v[1]);
            break;
        }
        case "vec3": {
            const v = value;
            if (!Array.isArray(v) || v.length < 3 || v.slice(0, 3).some((n) => typeof n !== "number")) {
                console.warn(`[Viro web] updateShaderUniform: "vec3" value for "${uniformName}" must be a 3-element number array`);
                break;
            }
            scene.setMaterialShaderUniformVec3(material, uniformName, v[0], v[1], v[2]);
            break;
        }
        case "vec4": {
            const v = value;
            if (!Array.isArray(v) || v.length < 4 || v.slice(0, 4).some((n) => typeof n !== "number")) {
                console.warn(`[Viro web] updateShaderUniform: "vec4" value for "${uniformName}" must be a 4-element number array`);
                break;
            }
            scene.setMaterialShaderUniformVec4(material, uniformName, v[0], v[1], v[2], v[3]);
            break;
        }
        case "mat4": {
            const v = value;
            if (!Array.isArray(v) || v.length !== 16 || v.some((n) => typeof n !== "number")) {
                console.warn(`[Viro web] updateShaderUniform: "mat4" value for "${uniformName}" must be a 16-element number array`);
                break;
            }
            scene.setMaterialShaderUniformMat4(material, uniformName, v);
            break;
        }
        case "sampler2D": {
            const url = (0, viroImageLoader_1.resolveImageSource)(value);
            if (!url) {
                console.warn(`[Viro web] updateShaderUniform: couldn't resolve an image source for sampler2D "${uniformName}"`);
                break;
            }
            (0, viroImageLoader_1.loadImageRGBA)(url)
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
