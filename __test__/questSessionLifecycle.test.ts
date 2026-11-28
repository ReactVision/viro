/**
 * Leaving and re-entering the Quest headset view, and `onHandUpdate` on
 * ViroXRSceneNavigator (workaround ID `viroreact-quest-hand-update`).
 *
 * A VRActivity's React surface is unloaded when the activity is destroyed, some time
 * after it starts finishing. In between, its ViroQuestEntryPoint is still mounted. It
 * used to stay subscribed to intents and navigator ops, so the next headset view's
 * intent mounted a second navigator in the dying activity, and that navigator took the
 * ops meant for the next one. What is tested here: an entry point stops listening the
 * moment its activity starts finishing, whether through exitVRScene() or the native
 * "ViroVRActivityFinishing" event, and the entry point of the next VRActivity still
 * gets the intent and the ops.
 */
const SCENE = { scene: () => null as any };
const OTHER_SCENE = { scene: () => null as any };

const mockLaunch = jest.fn();
const mockExit = jest.fn();
const mockDeviceListeners: Record<string, Array<() => void>> = {};
const mockCleanups: Array<() => void> = [];
const mockSetState = jest.fn();

jest.mock("react-native", () => ({
  NativeModules: {
    VRLauncher: { launchVRScene: () => mockLaunch(), exitVRScene: () => mockExit() },
  },
  AppState: { currentState: "active", addEventListener: () => ({ remove: () => {} }) },
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
  DeviceEventEmitter: {
    addListener: (name: string, cb: () => void) => {
      (mockDeviceListeners[name] ??= []).push(cb);
      return {
        remove: () => {
          mockDeviceListeners[name] = mockDeviceListeners[name].filter((l) => l !== cb);
        },
      };
    },
  },
  PermissionsAndroid: { requestMultiple: () => Promise.resolve({}) },
  Platform: { OS: "android", select: (o: any) => o.android ?? o.default, constants: {} },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  findNodeHandle: () => 1,
  requireNativeComponent: () => "VRTNative",
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));
// No DOM renderer in this suite, as in questRelaunch: components are called directly,
// effects run at once, and their cleanups are kept so a test can unmount.
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useRef: (v?: any) => ({ current: v ?? null }),
  useState: (init: any) => [typeof init === "function" ? init() : init, mockSetState],
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) mockCleanups.push(cleanup);
  },
  useImperativeHandle: () => {},
}));
jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: true,
  isVisionOS: false,
  isWeb: false,
}));

function load() {
  let loaded: {
    ViroXRSceneNavigator: any;
    ViroQuestEntryPoint: typeof import("../components/ViroQuestEntryPoint").ViroQuestEntryPoint;
    bridge: typeof import("../components/Utilities/VRQuestNavigatorBridge").VRQuestNavigatorBridge;
    exitVRScene: typeof import("../components/Utilities/VRModuleOpenXR").exitVRScene;
  };
  jest.isolateModules(() => {
    loaded = {
      ViroXRSceneNavigator: require("../components/ViroXRSceneNavigator").ViroXRSceneNavigator,
      ViroQuestEntryPoint: require("../components/ViroQuestEntryPoint").ViroQuestEntryPoint,
      bridge: require("../components/Utilities/VRQuestNavigatorBridge").VRQuestNavigatorBridge,
      exitVRScene: require("../components/Utilities/VRModuleOpenXR").exitVRScene,
    };
  });
  return loaded!;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));
const emitFinishing = () =>
  (mockDeviceListeners["ViroVRActivityFinishing"] ?? []).forEach((l) => l());

beforeEach(() => {
  mockLaunch.mockClear();
  mockExit.mockClear();
  mockSetState.mockClear();
  mockCleanups.length = 0;
  for (const name of Object.keys(mockDeviceListeners)) delete mockDeviceListeners[name];
});

describe("a ViroQuestEntryPoint whose VRActivity is finishing", () => {
  it("no longer answers intents once the native finish is reported", () => {
    const { ViroQuestEntryPoint, bridge } = load();
    bridge.setIntent(SCENE);
    ViroQuestEntryPoint();
    mockSetState.mockClear();

    bridge.setIntent(OTHER_SCENE);
    expect(mockSetState).toHaveBeenCalledTimes(1);
    mockSetState.mockClear();

    emitFinishing();
    bridge.setIntent(SCENE);

    expect(mockSetState).not.toHaveBeenCalled();
  });

  it("no longer answers intents after exitVRScene()", () => {
    const { ViroQuestEntryPoint, bridge, exitVRScene } = load();
    bridge.setIntent(SCENE);
    ViroQuestEntryPoint();
    mockSetState.mockClear();

    exitVRScene();
    bridge.setIntent(OTHER_SCENE);

    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(mockSetState).not.toHaveBeenCalled();
  });

  it("leaves navigator ops for the next VRActivity's entry point", () => {
    const { bridge } = load();
    const finishing = jest.fn();
    bridge.subscribeOps(finishing);
    bridge.setViewTag(7);

    bridge.retireEntryPoints();
    bridge.dispatchOp({ type: "push", scene: OTHER_SCENE });

    expect(finishing).not.toHaveBeenCalled();
    expect(bridge.getViewTag()).toBeNull();

    const next = jest.fn();
    bridge.subscribeOps(next);
    expect(next).toHaveBeenCalledWith({ type: "push", scene: OTHER_SCENE });
  });

  it("does not stop the next VRActivity's entry point from getting the intent", () => {
    const { ViroQuestEntryPoint, bridge } = load();
    bridge.setIntent(SCENE);
    ViroQuestEntryPoint();
    emitFinishing();

    // The panel's re-entry keeps the intent registered on mount; the next entry point
    // reads it as it mounts, and hears later ones.
    const next = jest.fn();
    bridge.onIntent(next);
    expect(next).toHaveBeenCalledWith(bridge.getIntent());
    bridge.setIntent(OTHER_SCENE);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("stops listening for the native event when it unmounts", () => {
    const { ViroQuestEntryPoint } = load();
    ViroQuestEntryPoint();
    expect(mockDeviceListeners["ViroVRActivityFinishing"]).toHaveLength(1);

    mockCleanups.splice(0).forEach((cleanup) => cleanup());

    expect(mockDeviceListeners["ViroVRActivityFinishing"]).toHaveLength(0);
  });
});

describe("onHandUpdate on ViroXRSceneNavigator (Quest)", () => {
  it("reaches the intent's renderer config, and so ViroVRSceneNavigator", async () => {
    const { ViroXRSceneNavigator, bridge } = load();
    const onHandUpdate = jest.fn();
    ViroXRSceneNavigator.render({ initialScene: SCENE, onHandUpdate }, null);
    await flush();

    const forwarded = bridge.getIntent()?.rendererConfig?.onHandUpdate;
    expect(typeof forwarded).toBe("function");
    const event = { nativeEvent: { left: null, right: null } };
    forwarded!(event);
    expect(onHandUpdate).toHaveBeenCalledWith(event);
  });

  it("is not subscribed when the prop is not given", async () => {
    const { ViroXRSceneNavigator, bridge } = load();
    ViroXRSceneNavigator.render({ initialScene: SCENE }, null);
    await flush();

    expect(bridge.getIntent()?.rendererConfig?.onHandUpdate).toBeUndefined();
  });
});
