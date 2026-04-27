/**
 * Studio material_config parsing and Viro material definition building.
 * Ported from studio-go/domain/materialConfig.ts — no zod dependency.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type ShaderModifierStage = {
  uniforms?: string;
  body?: string;
  varyings?: unknown;
  requiresSceneDepth?: boolean;
  requiresCameraTexture?: boolean;
  priority?: unknown;
};

export type MaterialConfig = {
  presetName?: string;
  lightingModel: "Constant" | "Lambert" | "Blinn" | "Phong" | "PBR";
  diffuseColor?: string;
  roughness?: number;
  metalness?: number;
  shininess?: number;
  alpha?: number;
  blendMode?: string;
  bloomThreshold?: number | null;
  wrapS?: "Clamp" | "Repeat" | "Mirror";
  wrapT?: "Clamp" | "Repeat" | "Mirror";
  diffuseTexture?: string | null;
  normalTexture?: string | null;
  roughnessTexture?: string | null;
  metalnessTexture?: string | null;
  ambientOcclusionTexture?: string | null;
  specularTexture?: string | null;
  shaderModifiers?: Record<string, ShaderModifierStage | string>;
  materialUniforms?: Array<{ name: string; type: string; value: unknown }>;
  transparencyMode?: string;
  cullMode?: string;
};

export type ViroMaterialDefinition = Record<string, unknown>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEXTURE_KEYS = [
  "diffuseTexture",
  "normalTexture",
  "roughnessTexture",
  "metalnessTexture",
  "ambientOcclusionTexture",
  "specularTexture",
] as const;

function textureToViro(uri: string | null | undefined): { uri: string } | undefined {
  if (uri == null || uri === "") return undefined;
  return { uri };
}

function collectShaderModifierStrings(config: MaterialConfig): string[] {
  const mods = config.shaderModifiers;
  if (!mods) return [];
  const strings: string[] = [];
  for (const stage of Object.values(mods)) {
    if (typeof stage === "string") {
      strings.push(stage);
    } else if (stage && typeof stage === "object") {
      const s = stage as ShaderModifierStage;
      if (typeof s.uniforms === "string") strings.push(s.uniforms);
      if (typeof s.body === "string") strings.push(s.body);
    }
  }
  return strings;
}

const TIME_WORD_RE = /\btime\b/i;
const CAMERA_TEXTURE_RE = /\bcamera_texture\b/;
const RF_VIEWPORT_RE = /\b_rf_vpw\b|\b_rf_vph\b/;

export function materialConfigNeedsTimeUniform(config: MaterialConfig): boolean {
  if (config.materialUniforms?.some((u) => u.name === "time")) return true;
  return collectShaderModifierStrings(config).some((s) => TIME_WORD_RE.test(s));
}

/**
 * True if the shader uses _rf_vpw/_rf_vph viewport uniforms.
 * These must be pushed via ViroMaterials.updateShaderUniform on mount and orientation change.
 */
export function materialConfigNeedsViewportUniforms(config: MaterialConfig): boolean {
  return collectShaderModifierStrings(config).some((s) => RF_VIEWPORT_RE.test(s));
}

/**
 * Prepends GLSL uniform declarations that the body references but the uniforms block omits.
 * Required when shaders are authored for remote delivery without explicit sampler declarations.
 */
function injectMissingGlslDeclarations(uniforms: string, body: string): string {
  let result = uniforms;
  if (CAMERA_TEXTURE_RE.test(body) && !CAMERA_TEXTURE_RE.test(result)) {
    result =
      "uniform sampler2D camera_texture;\nuniform highp mat4 camera_image_transform;\n" +
      result;
  }
  if (RF_VIEWPORT_RE.test(body) && !/\b_rf_vpw\b/.test(result)) {
    result = "uniform highp float _rf_vpw;\nuniform highp float _rf_vph;\n" + result;
  }
  return result;
}

/**
 * iOS only applies `ViroMaterials.updateShaderUniform` to uniforms registered
 * via `materialUniforms`. If a shader references `time` or viewport uniforms in
 * GLSL only, we add the runtime binding here.
 */
function mergeMaterialUniformsForViro(
  config: MaterialConfig,
): Array<{ name: string; type: string; value: unknown }> | undefined {
  const list = config.materialUniforms
    ? config.materialUniforms.map((u) => ({ name: u.name, type: u.type, value: u.value }))
    : [];

  if (materialConfigNeedsTimeUniform(config) && !list.some((u) => u.name === "time")) {
    list.push({ name: "time", type: "float", value: 0 });
  }

  if (materialConfigNeedsViewportUniforms(config)) {
    if (!list.some((u) => u.name === "_rf_vpw"))
      list.push({ name: "_rf_vpw", type: "float", value: 0 });
    if (!list.some((u) => u.name === "_rf_vph"))
      list.push({ name: "_rf_vph", type: "float", value: 0 });
  }

  return list.length > 0 ? list : undefined;
}

/**
 * Studio stores modifiers as `{ uniforms, body }`; Viro works best with a single
 * GLSL string per stage. Stages with advanced fields are kept as structured objects.
 * Camera texture usage is detected from GLSL and auto-flagged so the Viro native
 * layer binds the camera feed even when the DB JSON omits `requiresCameraTexture`.
 */
function normalizeShaderModifiersForViro(
  mods: NonNullable<MaterialConfig["shaderModifiers"]>,
): Record<string, string | object> {
  const out: Record<string, string | object> = {};
  for (const [key, stage] of Object.entries(mods)) {
    if (typeof stage === "string") {
      out[key] = stage;
      continue;
    }
    if (stage && typeof stage === "object") {
      const s = stage as ShaderModifierStage;
      const uniforms = typeof s.uniforms === "string" ? s.uniforms : "";
      const body = typeof s.body === "string" ? s.body : "";

      // Detect camera texture usage in GLSL even when the flag is absent from DB JSON.
      const usesCameraTexture =
        CAMERA_TEXTURE_RE.test(body) || CAMERA_TEXTURE_RE.test(uniforms);

      const hasAdvanced =
        s.varyings != null ||
        s.requiresSceneDepth === true ||
        s.requiresCameraTexture === true ||
        usesCameraTexture ||
        s.priority != null;

      if (hasAdvanced) {
        if (usesCameraTexture && s.requiresCameraTexture !== true) {
          // Auto-fix: flag the stage and inject any missing GLSL declarations so the
          // native Viro layer binds camera_texture and the shader compiles cleanly.
          out[key] = {
            ...s,
            requiresCameraTexture: true,
            uniforms: injectMissingGlslDeclarations(uniforms, body),
          };
        } else {
          out[key] = stage as object;
        }
        continue;
      }
      const merged = [uniforms.trim(), body.trim()].filter(Boolean).join("\n");
      out[key] = merged.length > 0 ? merged : (stage as object);
    }
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function studioMaterialName(assetId: string): string {
  return `studio_${assetId}`;
}

/**
 * Parses `scene_assets.material_config` JSON. Returns null if missing or invalid.
 */
export function parseMaterialConfig(raw: unknown): MaterialConfig | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;

  try {
    const config: MaterialConfig = {
      lightingModel:
        (["Constant", "Lambert", "Blinn", "Phong", "PBR"].includes(r.lightingModel as string)
          ? r.lightingModel
          : "PBR") as MaterialConfig["lightingModel"],
    };

    if (typeof r.presetName === "string")    config.presetName    = r.presetName;
    if (typeof r.diffuseColor === "string")  config.diffuseColor  = r.diffuseColor;
    if (typeof r.roughness === "number")     config.roughness     = r.roughness;
    if (typeof r.metalness === "number")     config.metalness     = r.metalness;
    if (typeof r.shininess === "number")     config.shininess     = r.shininess;
    if (typeof r.alpha === "number")         config.alpha         = r.alpha;
    if (typeof r.blendMode === "string")     config.blendMode     = r.blendMode;
    if (r.bloomThreshold != null && typeof r.bloomThreshold === "number")
                                             config.bloomThreshold = r.bloomThreshold;
    if (["Clamp","Repeat","Mirror"].includes(r.wrapS as string)) config.wrapS = r.wrapS as any;
    if (["Clamp","Repeat","Mirror"].includes(r.wrapT as string)) config.wrapT = r.wrapT as any;
    if (typeof r.transparencyMode === "string") config.transparencyMode = r.transparencyMode;
    if (typeof r.cullMode === "string")      config.cullMode      = r.cullMode;

    for (const key of TEXTURE_KEYS) {
      const v = r[key];
      if (typeof v === "string" || v === null) (config as any)[key] = v;
    }

    if (r.shaderModifiers && typeof r.shaderModifiers === "object" && !Array.isArray(r.shaderModifiers)) {
      config.shaderModifiers = r.shaderModifiers as Record<string, ShaderModifierStage | string>;
    }

    if (Array.isArray(r.materialUniforms)) {
      config.materialUniforms = r.materialUniforms.filter(
        (u): u is { name: string; type: string; value: unknown } =>
          u && typeof u.name === "string" && typeof u.type === "string",
      );
    }

    return config;
  } catch (e) {
    console.warn("[material_config] Failed to parse material_config", e);
    return null;
  }
}

/**
 * Maps a validated Studio material_config to Viro's `createMaterials` definition shape.
 */
export function buildViroMaterialDefinition(config: MaterialConfig): ViroMaterialDefinition {
  const out: ViroMaterialDefinition = { lightingModel: config.lightingModel };

  if (config.diffuseColor  !== undefined) out.diffuseColor  = config.diffuseColor;
  if (config.roughness     !== undefined) out.roughness     = config.roughness;
  if (config.metalness     !== undefined) out.metalness     = config.metalness;
  if (config.shininess     !== undefined) out.shininess     = config.shininess;
  if (config.alpha         !== undefined) out.alpha         = config.alpha;
  if (config.blendMode     !== undefined) out.blendMode     = config.blendMode;
  if (config.bloomThreshold!= undefined) out.bloomThreshold = config.bloomThreshold;
  if (config.wrapS         !== undefined) out.wrapS         = config.wrapS;
  if (config.wrapT         !== undefined) out.wrapT         = config.wrapT;
  if (config.transparencyMode !== undefined) out.transparencyMode = config.transparencyMode;
  if (config.cullMode      !== undefined) out.cullMode      = config.cullMode;

  for (const key of TEXTURE_KEYS) {
    const mapped = textureToViro((config as any)[key]);
    if (mapped !== undefined) out[key] = mapped;
  }

  if (config.shaderModifiers !== undefined) {
    out.shaderModifiers = normalizeShaderModifiersForViro(config.shaderModifiers);
  }

  const mergedUniforms = mergeMaterialUniformsForViro(config);
  if (mergedUniforms !== undefined) out.materialUniforms = mergedUniforms;

  return out;
}
