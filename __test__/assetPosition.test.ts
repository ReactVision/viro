import { studioAssetPosition } from "../components/Studio/domain/assetPosition";
import { StudioAsset } from "../components/Studio/types";

const asset = (extra: Partial<StudioAsset>): StudioAsset =>
  ({ id: "a", name: "asset", ...extra }) as unknown as StudioAsset;

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("studioAssetPosition", () => {
  it("passes an authored position through", () => {
    expect(
      studioAssetPosition(
        asset({ position_x: 1, position_y: 2, position_z: -3 })
      )
    ).toEqual([1, 2, -3]);
  });

  it("defaults a missing position to two metres in front of the camera", () => {
    expect(studioAssetPosition(asset({}))).toEqual([0, 0, -2]);
  });

  it("clamps a camera-relative asset authored too close", () => {
    expect(studioAssetPosition(asset({ position_z: -0.1 }))).toEqual([
      0, 0, -2,
    ]);
    expect(console.warn).toHaveBeenCalled();
  });

  it("leaves a marker asset's marker-frame Z alone", () => {
    expect(
      studioAssetPosition(
        asset({ position_z: 0.05, trigger_image_url: "https://cdn/marker.png" })
      )
    ).toEqual([0, 0, 0.05]);
  });

  it("leaves a world-placed asset's world Z alone", () => {
    const placed = { position_z: 3, world_placement: true };
    expect(studioAssetPosition(asset(placed as Partial<StudioAsset>))).toEqual([
      0, 0, 3,
    ]);
  });

  it("offsets a tap-to-place asset from the tap point, not from the camera", () => {
    expect(studioAssetPosition(asset({ tap_to_place: true }))).toEqual([
      0, 0, 0,
    ]);
    expect(
      studioAssetPosition(asset({ tap_to_place: true, position_z: -0.1 }))
    ).toEqual([0, 0, -0.1]);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
