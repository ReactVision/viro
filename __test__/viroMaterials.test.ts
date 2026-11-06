const mockSetJSMaterials = jest.fn();
jest.mock("react-native", () => ({
  NativeModules: { VRTMaterialManager: { setJSMaterials: (m: unknown) => mockSetJSMaterials(m) } },
  processColor: (c: unknown) => c,
  TurboModuleRegistry: { get: () => null },
}));
jest.mock("react-native/Libraries/Image/AssetRegistry", () => ({ getAssetByID: () => undefined }));
jest.mock("react-native/Libraries/Image/resolveAssetSource", () => ({
  __esModule: true,
  default: (s: any) => (s && s.uri ? { uri: s.uri, resolved: true } : null),
}));

import { ViroMaterials } from "../components/Material/ViroMaterials";

let warn: jest.SpyInstance;
beforeEach(() => {
  mockSetJSMaterials.mockClear();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("ViroMaterials.createMaterials", () => {
  it("skips a null texture instead of throwing, with a warning", () => {
    ViroMaterials.createMaterials({ m: { diffuseTexture: undefined } } as any);
    expect(mockSetJSMaterials).toHaveBeenCalledWith({ m: {} });
    expect(warn).toHaveBeenCalled();
  });

  it("does not change the caller's texture object for a source", () => {
    const texture = { source: { uri: "a.png" }, format: "RGBA8" };
    ViroMaterials.createMaterials({ m: { diffuseTexture: texture } } as any);
    expect(texture.source).toEqual({ uri: "a.png" });
    expect(mockSetJSMaterials.mock.calls[0][0].m.diffuseTexture).toEqual({
      source: { uri: "a.png", resolved: true },
      format: "RGBA8",
    });
  });

  it("warns for a texture that resolves to nothing", () => {
    ViroMaterials.createMaterials({ m: { diffuseTexture: { nothing: 1 } } } as any);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/did not resolve/));
  });

  it("takes a semanticMask without labels", () => {
    ViroMaterials.createMaterials({ m: { semanticMask: { mode: "show" } } } as any);
    expect(mockSetJSMaterials.mock.calls[0][0].m.semanticMask).toEqual({ mode: "show", labelMask: 0 });
  });
});
