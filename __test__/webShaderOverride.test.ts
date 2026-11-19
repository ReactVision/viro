/**
 * The JS half of a Studio material_config reaching a model on web:
 * buildViroMaterialDefinition -> the web material registry -> the C API.
 *
 * What this guards is the contract the C++ merge depends on. VROSceneWeb's
 * viroApplyShaderOverride copies seven properties off the override material and
 * nothing else, mirroring VRTNode.mm, so a property the registry stops writing
 * is a property no model can ever receive — and the symptom is a model that
 * renders, only wrong, which no type check catches.
 *
 * Not covered here: useViroNode's wiring (that shaderOverrides resolves each
 * name and calls applyShaderOverride once the model has loaded). That needs a
 * React renderer, which this package has no dev dependency for.
 */
import {
  applyARShadow,
  registerViroMaterials,
  createMaterialFromRegistry,
  deleteViroMaterials,
} from "../components/Web/viroMaterialRegistry";
import { buildViroMaterialDefinition } from "../components/Studio/domain/materialConfig";
import type { MaterialConfig } from "../components/Studio/domain/materialConfig";

/** Records the C API calls a material build makes, standing in for the WASM module. */
function fakeScene(effects = true) {
  const calls: Record<string, unknown[][]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      (calls[name] ??= []).push(args);
    };
  const scene = {
    createMaterial: () => 1,
    setMaterialLightingModel: record("setMaterialLightingModel"),
    setMaterialDiffuseColor: record("setMaterialDiffuseColor"),
    setMaterialShininess: record("setMaterialShininess"),
    setMaterialFresnelExponent: record("setMaterialFresnelExponent"),
    setMaterialRoughness: record("setMaterialRoughness"),
    setMaterialMetalness: record("setMaterialMetalness"),
    setMaterialDiffuseIntensity: record("setMaterialDiffuseIntensity"),
    setMaterialCullMode: record("setMaterialCullMode"),
    setMaterialBlendMode: record("setMaterialBlendMode"),
    setMaterialWritesToDepthBuffer: record("setMaterialWritesToDepthBuffer"),
    setMaterialReadsFromDepthBuffer: record("setMaterialReadsFromDepthBuffer"),
    addMaterialShaderModifier: record("addMaterialShaderModifier"),
    setMaterialShaderUniformFloat: record("setMaterialShaderUniformFloat"),
    setMaterialShaderUniformVec3: record("setMaterialShaderUniformVec3"),
    destroyMaterial: record("destroyMaterial"),
    ...(effects && {
      supportsMaterialEffects: true,
      setMaterialAlpha: record("setMaterialAlpha"),
      setMaterialBloomThreshold: record("setMaterialBloomThreshold"),
      setMaterialColorWriteMask: record("setMaterialColorWriteMask"),
      setMaterialChromaKey: record("setMaterialChromaKey"),
    }),
  };
  return { scene, calls };
}

// parseColorToRGBA asks a 1x1 canvas to parse the colour, so it needs a
// `document` to exist at all. This package has no jsdom, and jsdom alone would
// not help: without the `canvas` package getContext("2d") returns null there
// too. So the stub is the honest shape — a document whose canvas has no 2D
// context — and the parser's documented fallback (opaque white) is what the
// colour test reads. What that test guards is that the colour is written, not
// what it parses to.
const NAME = "studio_material_test";

beforeAll(() => {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({ getContext: () => null }),
  };
});

afterAll(() => {
  delete (globalThis as { document?: unknown }).document;
});

function build(config: MaterialConfig, name = NAME) {
  return buildDef(buildViroMaterialDefinition(config), name);
}

function buildDef(def: Record<string, unknown>, name = NAME, effects = true) {
  const { scene, calls } = fakeScene(effects);
  registerViroMaterials({ [name]: def });
  const handle = createMaterialFromRegistry(scene as never, name);
  return { handle, calls };
}

afterEach(() => {
  // Handles are cached by name, so a second build of the same name would return
  // the first one and record no calls at all.
  deleteViroMaterials([NAME]);
});

describe("a Studio material_config reaching the web C API", () => {
  test("writes the properties the shader-override merge reads", () => {
    const { handle, calls } = build({
      lightingModel: "Blinn",
      diffuseColor: "#3366FF",
      shininess: 4,
      cullMode: "Front",
      blendMode: "Alpha",
      writesToDepthBuffer: false,
    });

    expect(handle).toBe(1);
    // The four the merge copies beyond the lighting model, each carrying the
    // authored value rather than a default.
    expect(calls.setMaterialShininess?.[0]?.[1]).toBe(4);
    expect(calls.setMaterialCullMode).toHaveLength(1);
    expect(calls.setMaterialBlendMode).toHaveLength(1);
    expect(calls.setMaterialWritesToDepthBuffer?.[0]?.[1]).toBe(false);
    expect(calls.setMaterialLightingModel).toHaveLength(1);
  });

  test("writes the colour even though the merge drops it", () => {
    // The colour is written here and then deliberately not copied onto the
    // model, the same as on a phone. It still has to reach the material: a
    // ViroMaterials consumer that is not a shader override does read it.
    const { calls } = build({ lightingModel: "Constant", diffuseColor: "#FF8800" });
    expect(calls.setMaterialDiffuseColor).toHaveLength(1);
    // Four components, on the material this build created.
    expect(calls.setMaterialDiffuseColor![0]).toHaveLength(5);
    expect(calls.setMaterialDiffuseColor![0][0]).toBe(1);
  });

  test("carries shader modifiers, which the merge does copy", () => {
    const { calls } = build({
      lightingModel: "Constant",
      shaderModifiers: {
        surface: { body: "_surface.diffuse_color = vec4(1.0);" },
      },
    } as MaterialConfig);

    expect(calls.addMaterialShaderModifier).toHaveLength(1);
    const [, entryPoint, code] = calls.addMaterialShaderModifier![0] as [
      unknown,
      string,
      string,
    ];
    expect(entryPoint).toBe("surface");
    expect(code).toContain("_surface.diffuse_color");
  });

  test("leaves untouched what the config does not author", () => {
    // An absent property must not be written at all: the merge copies whatever
    // the override material holds, so a default written here would overwrite the
    // model's own value rather than leave it alone.
    const { calls } = build({ lightingModel: "Constant" });

    expect(calls.setMaterialShininess).toBeUndefined();
    expect(calls.setMaterialCullMode).toBeUndefined();
    expect(calls.setMaterialBlendMode).toBeUndefined();
    expect(calls.setMaterialWritesToDepthBuffer).toBeUndefined();
    expect(calls.setMaterialDiffuseColor).toBeUndefined();
  });
});

describe("alpha, bloom, colour write mask and chroma key on the web", () => {
  test("a translucent material stops writing depth unless the config says otherwise", () => {
    const { calls } = build({ lightingModel: "PBR", alpha: 0.5, blendMode: "Alpha" });
    expect(calls.setMaterialAlpha?.[0]?.[1]).toBe(0.5);
    expect(calls.setMaterialWritesToDepthBuffer).toEqual([[1, false]]);
    deleteViroMaterials([NAME]);

    const authored = build({ lightingModel: "PBR", alpha: 0.5, writesToDepthBuffer: true });
    expect(authored.calls.setMaterialWritesToDepthBuffer).toEqual([[1, true]]);
    deleteViroMaterials([NAME]);

    const opaque = build({ lightingModel: "PBR", alpha: 1 });
    expect(opaque.calls.setMaterialAlpha?.[0]?.[1]).toBe(1);
    expect(opaque.calls.setMaterialWritesToDepthBuffer).toBeUndefined();
  });

  test("reads the bloom threshold, the mask names and the chroma key colour as native does", () => {
    const { calls } = buildDef({
      bloomThreshold: 0.2,
      colorWriteMask: ["Red", "alpha"],
      chromaKeyFilteringColor: "#00ff00",
    });
    expect(calls.setMaterialBloomThreshold?.[0]?.[1]).toBe(0.2);
    expect(calls.setMaterialColorWriteMask?.[0]?.[1]).toBe(9);
    expect(calls.setMaterialChromaKey).toHaveLength(1);
    expect(calls.setMaterialAlpha).toBeUndefined();
  });

  test("Studio's null bloom threshold writes nothing", () => {
    const { calls } = build({ lightingModel: "PBR", bloomThreshold: null });
    expect(calls.setMaterialBloomThreshold).toBeUndefined();
  });

  test("an older renderer still builds the material, and says what it dropped", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    // An alpha of 1 draws the same there, so it is not worth a warning.
    buildDef({ lightingModel: "PBR", alpha: 1 }, NAME, false);
    expect(warn).not.toHaveBeenCalled();
    deleteViroMaterials([NAME]);

    const { handle, calls } = buildDef({ lightingModel: "PBR", alpha: 0.5, shininess: 3 }, NAME, false);
    expect(handle).toBe(1);
    expect(calls.setMaterialShininess?.[0]?.[1]).toBe(3);
    // Opaque there, so it keeps writing depth.
    expect(calls.setMaterialWritesToDepthBuffer).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("alpha"));
    warn.mockRestore();
  });
});

describe("a material's own uniforms on the web", () => {
  test("Studio's list, with the time uniform its shaders read, is set at creation", () => {
    const { calls } = build({
      lightingModel: "Constant",
      shaderModifiers: { surface: { uniforms: "uniform float time;", body: "_surface.alpha = time;" } },
      materialUniforms: [{ name: "tint", type: "vec3", value: [1, 0, 0] }],
    } as MaterialConfig);
    expect(calls.setMaterialShaderUniformVec3).toEqual([[1, "tint", 1, 0, 0]]);
    expect(calls.setMaterialShaderUniformFloat).toEqual([[1, "time", 0]]);
  });

  test("the map form under shaderUniforms is read too, as native reads it", () => {
    const { calls } = buildDef({ shaderUniforms: { strength: { type: "float", value: 0.4 } } });
    expect(calls.setMaterialShaderUniformFloat).toEqual([[1, "strength", 0.4]]);
  });
});

describe("arShadowReceiver on the web", () => {
  test("gives the material VROARShadow's lighting, depth and three modifiers", () => {
    const { scene, calls } = fakeScene();
    applyARShadow(scene as never, 7);
    expect(calls.setMaterialLightingModel).toEqual([[7, 4]]);
    expect(calls.setMaterialWritesToDepthBuffer).toEqual([[7, false]]);
    expect(calls.addMaterialShaderModifier?.map((c) => c[1])).toEqual(["surface", "lightingModel", "fragment"]);
    expect(calls.addMaterialShaderModifier?.[2]?.[2]).toContain("_output_color = vec4(0, 0, 0, 0);");
  });
});
