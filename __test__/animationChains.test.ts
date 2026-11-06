// registerAnimations: chains (names and nested arrays) reach the native module,
// and a color is processed wherever the animation sits in the chain.
jest.mock("react-native", () => ({
  NativeModules: { VRTAnimationManager: { setJSAnimations: jest.fn() } },
  processColor: (c: unknown) => `processed:${String(c)}`,
}));

import {
  ViroAnimationDict,
  ViroAnimations,
} from "../components/Animation/ViroAnimations";

const setJSAnimations: jest.Mock =
  jest.requireMock("react-native").NativeModules.VRTAnimationManager
    .setJSAnimations;

describe("ViroAnimations.registerAnimations", () => {
  beforeEach(() => setJSAnimations.mockClear());

  test("accepts a sequence of names, typed without a cast", () => {
    const animations: ViroAnimationDict = {
      floatUp: { duration: 500, properties: { positionY: "+=0.1" } },
      floatDown: { duration: 500, properties: { positionY: "-=0.1" } },
      float: [["floatUp", "floatDown"]],
      floatAndSpin: [
        ["floatUp", "floatDown"],
        { duration: 1000, properties: { rotateY: "+=360" } },
      ],
    };
    ViroAnimations.registerAnimations(animations);
    expect(setJSAnimations).toHaveBeenCalledWith(animations);
    expect(animations.float).toEqual([["floatUp", "floatDown"]]);
  });

  test("processes colors at the top level and inside chains", () => {
    const animations: ViroAnimationDict = {
      tint: { duration: 300, properties: { color: "red" } },
      blink: [
        [
          { duration: 300, properties: { color: "white" } },
          { duration: 300, properties: { color: "blue" } },
        ],
      ],
    };
    ViroAnimations.registerAnimations(animations);
    const sent = setJSAnimations.mock.calls[0][0];
    expect(sent.tint.properties.color).toBe("processed:red");
    expect(sent.blink[0][0].properties.color).toBe("processed:white");
    expect(sent.blink[0][1].properties.color).toBe("processed:blue");
  });
});
