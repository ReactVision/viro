/**
 * Screen capture on Meta Quest reaches native.
 *
 * The renderer could capture on Quest — ViroViewOpenXR.getRecorder() returns a
 * recorder sized to the eye swapchain — but nothing in JS reached it: the AR
 * navigator's module only accepts a VRTARSceneNavigator, and the VR navigator
 * a Quest scene is handed carried no capture methods at all. What is tested
 * here is the forwarding, with the same names, arguments and result shape as
 * ViroARSceneNavigator, so a scene captures through `sceneNavigator` on any
 * platform. A unit test cannot open an XR session; it can make sure the call
 * is not dropped before it gets there.
 */
import * as fs from "fs";
import * as path from "path";

const VIEW_TAG = 42;

const mockModule = {
  takeScreenshot: jest.fn(),
  startVideoRecording: jest.fn(),
  stopVideoRecording: jest.fn(),
};
let mockNativeModules: Record<string, unknown> = {};

jest.mock("react-native", () => ({
  get NativeModules() {
    return mockNativeModules;
  },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: "active" },
  PermissionsAndroid: { requestMultiple: jest.fn(() => Promise.resolve({})) },
  Platform: { OS: "android", select: (o: any) => o.android ?? o.default, constants: {} },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  findNodeHandle: jest.fn(() => VIEW_TAG),
  requireNativeComponent: jest.fn(() => "VRTNative"),
  View: "View",
  Text: "Text",
}));
// ViroXRSceneNavigator is a function component whose Quest branch builds its
// handle in useImperativeHandle and renders null. There is no DOM renderer in
// this suite, so its render function is called directly with the three hooks it
// uses stood in for; nothing else here uses hooks.
let mockCapturedHandle: any;
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useRef: (v?: any) => ({ current: v ?? null }),
  useEffect: () => {},
  useImperativeHandle: (_ref: any, factory: () => any) => {
    mockCapturedHandle = factory();
  },
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: true,
  isVisionOS: false,
  isWeb: false,
}));

const OK = { success: true, url: "/data/capture.jpg", errorCode: -1 };
const UNSUPPORTED = 6;
const NOT_READY = 7;

/** Loads a fresh copy of the modules against the NativeModules given. */
function load(nativeModules: Record<string, unknown>) {
  mockNativeModules = nativeModules;
  let loaded: {
    VRCapture: typeof import("../components/Utilities/VRModuleOpenXR").VRCapture;
    ViroVRSceneNavigator: typeof import("../components/ViroVRSceneNavigator").ViroVRSceneNavigator;
    ViroSceneNavigator: typeof import("../components/ViroSceneNavigator").ViroSceneNavigator;
    ViroXRSceneNavigator: any;
    VRQuestNavigatorBridge: typeof import("../components/Utilities/VRQuestNavigatorBridge").VRQuestNavigatorBridge;
    constants: typeof import("../components/ViroConstants");
  };
  jest.isolateModules(() => {
    loaded = {
      VRCapture: require("../components/Utilities/VRModuleOpenXR").VRCapture,
      ViroVRSceneNavigator: require("../components/ViroVRSceneNavigator").ViroVRSceneNavigator,
      ViroSceneNavigator: require("../components/ViroSceneNavigator").ViroSceneNavigator,
      ViroXRSceneNavigator: require("../components/ViroXRSceneNavigator").ViroXRSceneNavigator,
      VRQuestNavigatorBridge: require("../components/Utilities/VRQuestNavigatorBridge")
        .VRQuestNavigatorBridge,
      constants: require("../components/ViroConstants"),
    };
  });
  return loaded!;
}

const SCENE = { scene: () => null as any };

beforeEach(() => {
  jest.clearAllMocks();
  mockModule.takeScreenshot.mockResolvedValue(OK);
  mockModule.stopVideoRecording.mockResolvedValue({ ...OK, url: "/data/capture.mp4" });
});

describe("the error codes", () => {
  it("names the two codes the Quest path adds, next to the recorder's own", () => {
    const { constants } = load({});
    expect(constants.ViroRecordingErrorConstants.RECORD_ERROR_UNSUPPORTED_PLATFORM).toBe(UNSUPPORTED);
    expect(constants.ViroRecordingErrorConstants.RECORD_ERROR_NOT_READY).toBe(NOT_READY);
  });
});

describe("the VR scene navigator a Quest scene is handed", () => {
  function sceneNavigator() {
    const { ViroVRSceneNavigator } = load({ VRModuleOpenXR: mockModule });
    const nav = new ViroVRSceneNavigator({ initialScene: SCENE } as any);
    return nav.sceneNavigator as any;
  }

  it("takes a screenshot through VRModuleOpenXR with its own view tag", async () => {
    const result = await sceneNavigator().takeScreenshot("shot", true);
    expect(mockModule.takeScreenshot).toHaveBeenCalledWith(VIEW_TAG, "shot", true);
    expect(result).toEqual(OK);
  });

  it("starts and stops a recording, with the AR navigator's arguments", async () => {
    const nav = sceneNavigator();
    const onError = jest.fn();
    nav.startVideoRecording("clip", false, onError);
    expect(mockModule.startVideoRecording).toHaveBeenCalledWith(VIEW_TAG, "clip", false, onError);

    const result = await nav.stopVideoRecording();
    expect(mockModule.stopVideoRecording).toHaveBeenCalledWith(VIEW_TAG);
    expect(result).toEqual({ success: true, url: "/data/capture.mp4", errorCode: -1 });
  });

  it("passes a native failure through as it came", async () => {
    mockModule.takeScreenshot.mockResolvedValue({ success: false, url: null, errorCode: NOT_READY });
    const result = await sceneNavigator().takeScreenshot("shot", false);
    expect(result).toEqual({ success: false, url: null, errorCode: NOT_READY });
  });

  it("reports unsupported, rather than throwing, where there is no VRModuleOpenXR", async () => {
    // iOS, visionOS and Cardboard on Android: the module is Quest-only.
    const { ViroVRSceneNavigator } = load({});
    const nav = new ViroVRSceneNavigator({ initialScene: SCENE } as any).sceneNavigator as any;

    await expect(nav.takeScreenshot("shot", true)).resolves.toEqual({
      success: false,
      url: null,
      errorCode: UNSUPPORTED,
    });
    await expect(nav.stopVideoRecording()).resolves.toEqual({
      success: false,
      url: null,
      errorCode: UNSUPPORTED,
    });
    const onError = jest.fn();
    nav.startVideoRecording("clip", true, onError);
    expect(onError).toHaveBeenCalledWith(UNSUPPORTED);
  });
});

describe("VRCapture without a view tag", () => {
  it("reports not ready until the VR scene has mounted", async () => {
    const { VRCapture } = load({ VRModuleOpenXR: mockModule });
    await expect(VRCapture.takeScreenshot(null, "shot", true)).resolves.toEqual({
      success: false,
      url: null,
      errorCode: NOT_READY,
    });
    await expect(VRCapture.stopVideoRecording(null)).resolves.toMatchObject({
      errorCode: NOT_READY,
    });
    const onError = jest.fn();
    VRCapture.startVideoRecording(null, "clip", true, onError);
    expect(onError).toHaveBeenCalledWith(NOT_READY);
    expect(mockModule.takeScreenshot).not.toHaveBeenCalled();
    expect(mockModule.startVideoRecording).not.toHaveBeenCalled();
    expect(mockModule.stopVideoRecording).not.toHaveBeenCalled();
  });
});

describe("the generic ViroSceneNavigator (visionOS, iOS VR)", () => {
  it("carries the three names and reports unsupported", async () => {
    const { ViroSceneNavigator } = load({ VRModuleOpenXR: mockModule });
    const nav = new ViroSceneNavigator({ initialScene: SCENE } as any).sceneNavigator as any;

    await expect(nav.takeScreenshot("shot", true)).resolves.toMatchObject({
      success: false,
      errorCode: UNSUPPORTED,
    });
    await expect(nav.stopVideoRecording()).resolves.toMatchObject({ errorCode: UNSUPPORTED });
    const onError = jest.fn();
    nav.startVideoRecording("clip", true, onError);
    expect(onError).toHaveBeenCalledWith(UNSUPPORTED);
    // It never hosts the Quest view, so it must not reach for the Quest module.
    expect(mockModule.takeScreenshot).not.toHaveBeenCalled();
  });
});

describe("the Quest branch of ViroXRSceneNavigator's ref", () => {
  /** Runs the component's render once, capturing what it hands its ref. */
  function questHandle() {
    const loaded = load({ VRModuleOpenXR: mockModule });
    mockCapturedHandle = undefined;
    const out = loaded.ViroXRSceneNavigator.render({ initialScene: SCENE }, null);
    expect(out).toBeNull(); // VRActivity owns the display on Quest
    return { handle: mockCapturedHandle, bridge: loaded.VRQuestNavigatorBridge };
  }

  it("forwards capture with the VR scene's published tag", async () => {
    const { handle, bridge } = questHandle();
    bridge.setViewTag(VIEW_TAG);

    for (const nav of [handle.sceneNavigator, handle.arSceneNavigator]) {
      await expect(nav.takeScreenshot("shot", true)).resolves.toEqual(OK);
      const onError = jest.fn();
      nav.startVideoRecording("clip", true, onError);
      await nav.stopVideoRecording();
      expect(mockModule.startVideoRecording).toHaveBeenLastCalledWith(VIEW_TAG, "clip", true, onError);
    }
    expect(mockModule.takeScreenshot).toHaveBeenCalledWith(VIEW_TAG, "shot", true);
    expect(mockModule.stopVideoRecording).toHaveBeenCalledWith(VIEW_TAG);
    bridge.setViewTag(null);
  });

  it("reports not ready before the VR scene has published its tag", async () => {
    const { handle, bridge } = questHandle();
    bridge.setViewTag(null);
    await expect(handle.sceneNavigator.takeScreenshot("shot", true)).resolves.toMatchObject({
      success: false,
      errorCode: NOT_READY,
    });
    expect(mockModule.takeScreenshot).not.toHaveBeenCalled();
  });
});

describe("the native methods behind it", () => {
  const bridge = path.resolve(
    __dirname,
    "..",
    "android",
    "viro_bridge",
    "src",
    "main",
    "java",
    "com",
    "viromedia",
    "bridge"
  );
  const module = fs.readFileSync(path.join(bridge, "module", "VRModuleOpenXR.java"), "utf-8");

  it("declares the three @ReactMethods JS calls on VRModuleOpenXR", () => {
    expect(module).toMatch(/@ReactMethod\s+public void takeScreenshot\(final int sceneNavTag, final String fileName,\s+final boolean saveToCameraRoll, final Promise promise\)/);
    expect(module).toMatch(/@ReactMethod\s+public void startVideoRecording\(final int sceneNavTag, final String fileName,\s+final boolean saveToCameraRoll, final Callback reactErrorDelegate\)/);
    expect(module).toMatch(/@ReactMethod\s+public void stopVideoRecording\(final int sceneNavTag, final Promise promise\)/);
  });

  it("captures only from an OpenXR view on the Quest navigator", () => {
    expect(module).toContain("instanceof VRTVRSceneNavigator");
    expect(module).toContain("instanceof ViroViewOpenXR");
    expect(module).toContain("getRecorder()");
  });

  it("uses the same numeric codes as the JS constants", () => {
    const capture = fs.readFileSync(path.join(bridge, "module", "MediaCapture.java"), "utf-8");
    expect(capture).toContain(`UNSUPPORTED_PLATFORM_ERROR = ${UNSUPPORTED};`);
    expect(capture).toContain(`NOT_READY_ERROR = ${NOT_READY};`);
  });
});
