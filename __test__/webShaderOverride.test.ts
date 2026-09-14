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
  registerViroMaterials,
  createMaterialFromRegistry,
  deleteViroMaterials,
} from "../components/Web/viroMaterialRegistry";
import { buildViroMaterialDefinition } from "../components/Studio/domain/materialConfig";
import type { MaterialConfig } from "../components/Studio/domain/materialConfig";

/** Records the C API calls a material build makes, standing in for the WASM module. */
function fakeScene() {
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
    destroyMaterial: record("destroyMaterial"),
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
  const { scene, calls } = fakeScene();
  registerViroMaterials({ [name]: buildViroMaterialDefinition(config) });
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
