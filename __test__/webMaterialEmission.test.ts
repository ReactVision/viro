/**
 * emissionColor, emissionTexture and reflectiveTexture through the web material
 * registry, and what a renderer without them does instead.
 */
jest.mock("../components/Web/viroImageLoader", () => ({
  resolveImageSource: (s: unknown) => (typeof s === "string" ? s : null),
  loadImageRGBA: (url: string) => Promise.resolve({ pixels: new Uint8Array(Buffer.from(url)), width: 2, height: 2 }),
}));
jest.mock("../components/Web/viroColor", () => ({ parseColorToRGBA: () => [1, 0.5, 0, 1] }));

import { createMaterialFromRegistry, deleteViroMaterials, registerViroMaterials } from "../components/Web/viroMaterialRegistry";
import { resetUnsupportedWarnings } from "../components/Utilities/ViroUnsupported";

const EMISSION = 6;
const REFLECTIVE = 7;
const NAME = "emission_test";
const SKY = { px: "px.png", nx: "nx.png", py: "py.png", ny: "ny.png", pz: "pz.png", nz: "nz.png" };

function fakeScene(supported: boolean) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string, result?: unknown) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return result;
  };
  const scene = {
    createMaterial: () => 1,
    setMaterialLightingModel: record("setMaterialLightingModel"),
    setMaterialDiffuseColor: record("setMaterialDiffuseColor"),
    createTextureRGBA: record("createTextureRGBA", 10),
    createTextureCubeRGBA: record("createTextureCubeRGBA", 20),
    setTextureWrap: record("setTextureWrap"),
    setTextureFilter: record("setTextureFilter"),
    setMaterialTexture: record("setMaterialTexture"),
    destroyMaterial: record("destroyMaterial"),
    ...(supported && {
      supportsEmissionAndReflection: true,
      setMaterialEmissionColor: record("setMaterialEmissionColor", true),
    }),
  };
  return { scene, calls };
}

async function build(def: Record<string, unknown>, supported = true) {
  const { scene, calls } = fakeScene(supported);
  registerViroMaterials({ [NAME]: def });
  createMaterialFromRegistry(scene as never, NAME);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return calls;
}

let warn: jest.SpyInstance;
beforeEach(() => {
  resetUnsupportedWarnings();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  deleteViroMaterials([NAME]);
  warn.mockRestore();
});

test("sets the emission colour, the emission texture and a reflective cube map", async () => {
  const calls = await build({ emissionColor: "#ff8000", emissionTexture: "glow.png", reflectiveTexture: SKY });

  expect(calls.setMaterialEmissionColor).toEqual([[1, 1, 0.5, 0]]);
  // Linear, as native loads it.
  expect(calls.createTextureRGBA?.[0]?.[3]).toBe(false);
  // Each face gets its own image; the fake pixels are the image's URL.
  const [faces, width, height] = calls.createTextureCubeRGBA![0] as [Record<string, Uint8Array>, number, number];
  for (const [face, url] of Object.entries(SKY)) expect(Buffer.from(faces[face]!).toString()).toBe(url);
  expect([width, height]).toEqual([2, 2]);
  expect(calls.setMaterialTexture).toEqual(expect.arrayContaining([[1, EMISSION, 10], [1, REFLECTIVE, 20]]));
  expect(warn).not.toHaveBeenCalled();
});

test("an older renderer warns once and keeps both channels off the diffuse", async () => {
  const calls = await build({ diffuseTexture: "d.png", emissionColor: "#ffffff", emissionTexture: "e.png", reflectiveTexture: SKY }, false);

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn.mock.calls[0][0]).toMatch(/emissionColor, emissionTexture and reflectiveTexture/);
  expect(calls.createTextureCubeRGBA).toBeUndefined();
  expect(calls.setMaterialTexture).toEqual([[1, 0, 10]]);
});

test("a current renderer on an older wasm warns the same way", async () => {
  const { scene, calls } = fakeScene(true);
  scene.supportsEmissionAndReflection = false;
  registerViroMaterials({ [NAME]: { emissionColor: "#ffffff", reflectiveTexture: SKY } });
  createMaterialFromRegistry(scene as never, NAME);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(warn).toHaveBeenCalledTimes(1);
  expect(calls.setMaterialEmissionColor).toBeUndefined();
  expect(calls.setMaterialTexture).toBeUndefined();
});

test("a material without them sets nothing and warns about nothing", async () => {
  const calls = await build({ diffuseColor: "#ffffff" }, false);
  expect(calls.setMaterialEmissionColor).toBeUndefined();
  expect(calls.setMaterialTexture).toBeUndefined();
  expect(warn).not.toHaveBeenCalled();
});

test("a cube map missing a face is not built", async () => {
  const calls = await build({ reflectiveTexture: { ...SKY, nz: undefined } });
  expect(calls.createTextureCubeRGBA).toBeUndefined();
  expect(calls.setMaterialEmissionColor).toBeUndefined();
});
