// getAssetByID comes from `react-native`'s AssetRegistry export on 0.88 and from
// Libraries/Image/AssetRegistry on the 0.86 visionOS fork, which has no export.

beforeEach(() => jest.resetModules());

function load(rn: object, legacy?: object) {
  let mod: typeof import("../components/Utilities/ViroAssetRegistry");
  jest.isolateModules(() => {
    jest.doMock("react-native", () => rn);
    if (legacy) {
      jest.doMock("react-native/Libraries/Image/AssetRegistry", () => legacy, { virtual: true });
    } else {
      jest.doMock(
        "react-native/Libraries/Image/AssetRegistry",
        () => {
          throw new Error("Cannot find module");
        },
        { virtual: true }
      );
    }
    mod = require("../components/Utilities/ViroAssetRegistry");
  });
  return mod!;
}

describe("getAssetByIDFunction", () => {
  it("uses the react-native export when there is one", () => {
    const { getAssetByIDFunction } = load(
      { AssetRegistry: { getAssetByID: (id: number) => ({ id, from: "export" }) } },
      { getAssetByID: () => ({ from: "legacy" }) }
    );
    expect(getAssetByIDFunction()!(3)).toEqual({ id: 3, from: "export" });
  });

  it("falls back to Libraries/Image/AssetRegistry without the export", () => {
    const { getAssetByIDFunction } = load({}, { getAssetByID: (id: number) => ({ id, from: "legacy" }) });
    expect(getAssetByIDFunction()!(5)).toEqual({ id: 5, from: "legacy" });
  });

  it("returns null when neither is there", () => {
    const { getAssetByIDFunction } = load({});
    expect(getAssetByIDFunction()).toBeNull();
  });
});

describe("ViroMaterials without an asset registry", () => {
  it("skips a require() texture with one warning instead of throwing", () => {
    const setJSMaterials = jest.fn();
    let ViroMaterials: any;
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({
        NativeModules: { VRTMaterialManager: { setJSMaterials } },
        processColor: (c: unknown) => c,
        TurboModuleRegistry: { get: () => null },
      }));
      jest.doMock(
        "react-native/Libraries/Image/AssetRegistry",
        () => {
          throw new Error("Cannot find module");
        },
        { virtual: true }
      );
      jest.doMock("react-native/Libraries/Image/resolveAssetSource", () => ({
        __esModule: true,
        default: () => ({ uri: "x" }),
      }));
      ViroMaterials = require("../components/Material/ViroMaterials").ViroMaterials;
    });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      ViroMaterials.createMaterials({ a: { diffuseTexture: 1, diffuseColor: "red" }, b: { normalTexture: 2 } });
      expect(setJSMaterials).toHaveBeenCalledWith({ a: { diffuseColor: "red" }, b: {} });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/AssetRegistry is not available/));
    } finally {
      warn.mockRestore();
    }
  });
});
