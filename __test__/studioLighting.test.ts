import { studioLightScale } from "../components/Studio/domain/studioLighting";

/**
 * The estimate is what `onAmbientLightUpdate` reports: ARKit's ambientIntensity
 * in lumens, and on Android ARCore's pixel intensity scaled to the same range
 * by VROARFrameARCore and VRTARScene. 1000 is a neutrally lit room on both.
 */
describe("studioLightScale", () => {
  it("renders the rig as authored in a neutrally lit room", () => {
    expect(studioLightScale(1000)).toBe(1);
  });

  it("dims proportionally in a darker room", () => {
    expect(studioLightScale(500)).toBe(0.5);
    expect(studioLightScale(300)).toBeCloseTo(0.3, 10);
  });

  it("never brightens past the authored rig, which has no headroom", () => {
    expect(studioLightScale(1500)).toBe(1);
    expect(studioLightScale(100000)).toBe(1);
  });

  it("floors a very dark room so the content stays visible", () => {
    expect(studioLightScale(1)).toBe(0.25);
  });

  it("falls back to the authored rig for a value the session cannot supply", () => {
    for (const estimate of [0, -1, NaN, Infinity]) {
      expect(studioLightScale(estimate)).toBe(1);
    }
  });
});
