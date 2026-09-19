// The module reaches ViroAnimations, and through it react-native, at import
// time; only the registry builder is under test here.
jest.mock("react-native", () => ({
  NativeModules: {},
  processColor: (c: unknown) => c,
}));

import { buildViroAnimationRegistry } from "../components/Studio/domain/animationRegistry";
import { StudioAnimation } from "../components/Studio/types";

const animation = (over: Partial<StudioAnimation>): StudioAnimation =>
  ({
    id: "f1",
    scene_id: "s1",
    target_asset_id: "a1",
    animation_key: "rise",
    properties: { positionY: "+=0.8" },
    duration_ms: 2000,
    delay_ms: 2000,
    easing: "Linear",
    loop: false,
    interruptible: false,
    on_start_function: null,
    on_finish_function: null,
    ...over,
  }) as StudioAnimation;

describe("buildViroAnimationRegistry", () => {
  test("carries no delay, which the runtime would wait out a second time", () => {
    const entry = buildViroAnimationRegistry([animation({})])["rise"] as Record<
      string,
      unknown
    >;
    expect(entry).not.toHaveProperty("delay");
    expect(entry).toEqual({
      properties: { positionY: "+=0.8" },
      duration: 2000,
      easing: "Linear",
    });
  });

  test("duration falls back to a second and easing is left out when unset", () => {
    const entry = buildViroAnimationRegistry([
      animation({ duration_ms: null, easing: null }),
    ])["rise"];
    expect(entry).toEqual({
      properties: { positionY: "+=0.8" },
      duration: 1000,
    });
  });

  test("a model clip has no keyframes to register", () => {
    expect(
      buildViroAnimationRegistry([
        animation({ animation_source: "MODEL_CLIP", clip_name: "Idle" }),
      ])
    ).toEqual({});
  });
});
