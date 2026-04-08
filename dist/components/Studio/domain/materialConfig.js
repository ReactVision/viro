"use strict";
/**
 * Studio material_config parsing and Viro material definition building.
 * Ported from studio-go/domain/materialConfig.ts — no zod dependency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.materialConfigNeedsTimeUniform = materialConfigNeedsTimeUniform;
exports.studioMaterialName = studioMaterialName;
exports.parseMaterialConfig = parseMaterialConfig;
exports.buildViroMaterialDefinition = buildViroMaterialDefinition;
// ─── Helpers ──────────────────────────────────────────────────────────────────
const TEXTURE_KEYS = [
    "diffuseTexture",
    "normalTexture",
    "roughnessTexture",
    "metalnessTexture",
    "ambientOcclusionTexture",
    "specularTexture",
];
function textureToViro(uri) {
    if (uri == null || uri === "")
        return undefined;
    return { uri };
}
function collectShaderModifierStrings(config) {
    const mods = config.shaderModifiers;
    if (!mods)
        return [];
    const strings = [];
    for (const stage of Object.values(mods)) {
        if (typeof stage === "string") {
            strings.push(stage);
        }
        else if (stage && typeof stage === "object") {
            const s = stage;
            if (typeof s.uniforms === "string")
                strings.push(s.uniforms);
            if (typeof s.body === "string")
                strings.push(s.body);
        }
    }
    return strings;
}
const TIME_WORD_RE = /\btime\b/i;
function materialConfigNeedsTimeUniform(config) {
    if (config.materialUniforms?.some((u) => u.name === "time"))
        return true;
    return collectShaderModifierStrings(config).some((s) => TIME_WORD_RE.test(s));
}
/**
 * iOS only applies `ViroMaterials.updateShaderUniform` to uniforms registered
 * via `materialUniforms`. If a shader references `time` in GLSL only, we add
 * the runtime binding here.
 */
function mergeMaterialUniformsForViro(config) {
    const list = config.materialUniforms
        ? config.materialUniforms.map((u) => ({ name: u.name, type: u.type, value: u.value }))
        : [];
    if (materialConfigNeedsTimeUniform(config) && !list.some((u) => u.name === "time")) {
        list.push({ name: "time", type: "float", value: 0 });
    }
    return list.length > 0 ? list : undefined;
}
/**
 * Studio stores modifiers as `{ uniforms, body }`; Viro works best with a single
 * GLSL string per stage. Stages with advanced fields are left as structured objects.
 */
function normalizeShaderModifiersForViro(mods) {
    const out = {};
    for (const [key, stage] of Object.entries(mods)) {
        if (typeof stage === "string") {
            out[key] = stage;
            continue;
        }
        if (stage && typeof stage === "object") {
            const s = stage;
            const hasAdvanced = s.varyings != null ||
                s.requiresSceneDepth === true ||
                s.requiresCameraTexture === true ||
                s.priority != null;
            if (hasAdvanced) {
                out[key] = stage;
                continue;
            }
            const uniforms = typeof s.uniforms === "string" ? s.uniforms.trim() : "";
            const body = typeof s.body === "string" ? s.body.trim() : "";
            const merged = [uniforms, body].filter(Boolean).join("\n");
            out[key] = merged.length > 0 ? merged : stage;
        }
    }
    return out;
}
// ─── Public API ───────────────────────────────────────────────────────────────
function studioMaterialName(assetId) {
    return `studio_${assetId}`;
}
/**
 * Parses `scene_assets.material_config` JSON. Returns null if missing or invalid.
 */
function parseMaterialConfig(raw) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw))
        return null;
    const r = raw;
    try {
        const config = {
            lightingModel: (["Constant", "Lambert", "Blinn", "Phong", "PBR"].includes(r.lightingModel)
                ? r.lightingModel
                : "PBR"),
        };
        if (typeof r.presetName === "string")
            config.presetName = r.presetName;
        if (typeof r.diffuseColor === "string")
            config.diffuseColor = r.diffuseColor;
        if (typeof r.roughness === "number")
            config.roughness = r.roughness;
        if (typeof r.metalness === "number")
            config.metalness = r.metalness;
        if (typeof r.shininess === "number")
            config.shininess = r.shininess;
        if (typeof r.alpha === "number")
            config.alpha = r.alpha;
        if (typeof r.blendMode === "string")
            config.blendMode = r.blendMode;
        if (r.bloomThreshold != null && typeof r.bloomThreshold === "number")
            config.bloomThreshold = r.bloomThreshold;
        if (["Clamp", "Repeat", "Mirror"].includes(r.wrapS))
            config.wrapS = r.wrapS;
        if (["Clamp", "Repeat", "Mirror"].includes(r.wrapT))
            config.wrapT = r.wrapT;
        if (typeof r.transparencyMode === "string")
            config.transparencyMode = r.transparencyMode;
        if (typeof r.cullMode === "string")
            config.cullMode = r.cullMode;
        for (const key of TEXTURE_KEYS) {
            const v = r[key];
            if (typeof v === "string" || v === null)
                config[key] = v;
        }
        if (r.shaderModifiers && typeof r.shaderModifiers === "object" && !Array.isArray(r.shaderModifiers)) {
            config.shaderModifiers = r.shaderModifiers;
        }
        if (Array.isArray(r.materialUniforms)) {
            config.materialUniforms = r.materialUniforms.filter((u) => u && typeof u.name === "string" && typeof u.type === "string");
        }
        return config;
    }
    catch (e) {
        console.warn("[material_config] Failed to parse material_config", e);
        return null;
    }
}
/**
 * Maps a validated Studio material_config to Viro's `createMaterials` definition shape.
 */
function buildViroMaterialDefinition(config) {
    const out = { lightingModel: config.lightingModel };
    if (config.diffuseColor !== undefined)
        out.diffuseColor = config.diffuseColor;
    if (config.roughness !== undefined)
        out.roughness = config.roughness;
    if (config.metalness !== undefined)
        out.metalness = config.metalness;
    if (config.shininess !== undefined)
        out.shininess = config.shininess;
    if (config.alpha !== undefined)
        out.alpha = config.alpha;
    if (config.blendMode !== undefined)
        out.blendMode = config.blendMode;
    if (config.bloomThreshold != undefined)
        out.bloomThreshold = config.bloomThreshold;
    if (config.wrapS !== undefined)
        out.wrapS = config.wrapS;
    if (config.wrapT !== undefined)
        out.wrapT = config.wrapT;
    if (config.transparencyMode !== undefined)
        out.transparencyMode = config.transparencyMode;
    if (config.cullMode !== undefined)
        out.cullMode = config.cullMode;
    for (const key of TEXTURE_KEYS) {
        const mapped = textureToViro(config[key]);
        if (mapped !== undefined)
            out[key] = mapped;
    }
    if (config.shaderModifiers !== undefined) {
        out.shaderModifiers = normalizeShaderModifiersForViro(config.shaderModifiers);
    }
    const mergedUniforms = mergeMaterialUniformsForViro(config);
    if (mergedUniforms !== undefined)
        out.materialUniforms = mergedUniforms;
    return out;
}
