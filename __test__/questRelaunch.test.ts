/**
 * The Quest headset view is not reopened on its own.
 *
 * Horizon OS brings an app's 2D panel (MainActivity) forward when the wearer
 * goes Home or opens Settings, and the generated VRActivity finishes itself
 * when that happens. ViroXRSceneNavigator used to relaunch VR whenever the app
 * became active again after more than 1.5 s away, so the headset view reopened
 * over Settings within milliseconds and the app could not be left. What is
 * tested here: the navigator launches once on mount, a trip to the background
 * launches nothing, the panel reopens it, and the VR active flag clears when
 * VRActivity's surface unmounts however VRActivity ended.
 */
const SCENE = { scene: () => null as any };

const mockLaunch = jest.fn();
const mockAppStateListeners: Array<(state: string) => void> = [];
const mockCleanups: Array<() => void> = [];

jest.mock("react-native", () => ({
  NativeModules: { VRLauncher: { launchVRScene: () => mockLaunch() } },
  AppState: {
    currentState: "active",
    addEventListener: (_type: string, cb: (state: string) => void) => {
      mockAppStateListeners.push(cb);
      return { remove: () => {} };
    },
  },
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
  PermissionsAndroid: { requestMultiple: () => Promise.resolve({}) },
  Platform: { OS: "android", select: (o: any) => o.android ?? o.default, constants: {} },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  findNodeHandle: () => 1,
  requireNativeComponent: () => "VRTNative",
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
}));
// No DOM renderer in this suite: both components are called directly, effects
// run at once, and their cleanups are kept so a test can unmount.
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useRef: (v?: any) => ({ current: v ?? null }),
  useState: (init: any) => [typeof init === "function" ? init() : init, () => {}],
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
  };
  jest.isolateModules(() => {
    loaded = {
      ViroXRSceneNavigator: require("../components/ViroXRSceneNavigator").ViroXRSceneNavigator,
      ViroQuestEntryPoint: require("../components/ViroQuestEntryPoint").ViroQuestEntryPoint,
      bridge: require("../components/Utilities/VRQuestNavigatorBridge").VRQuestNavigatorBridge,
    };
  });
  return loaded!;
}

/** Lets the permission request resolve, which is what the first launch waits on. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  mockLaunch.mockClear();
  mockAppStateListeners.length = 0;
  mockCleanups.length = 0;
});

describe("ViroXRSceneNavigator on Quest", () => {
  it("launches the headset view once, and not again when the app becomes active", async () => {
    const { ViroXRSceneNavigator } = load();
    ViroXRSceneNavigator.render({ initialScene: SCENE }, null);
    await flush();
    expect(mockLaunch).toHaveBeenCalledTimes(1);

    // Home or Settings: the panel leaves "active", then comes forward seconds later.
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    mockAppStateListeners.forEach((l) => l("background"));
    now.mockReturnValue(1_005_000);
    mockAppStateListeners.forEach((l) => l("active"));
    now.mockRestore();

    expect(mockLaunch).toHaveBeenCalledTimes(1);
  });

  it("reopens it from the panel with the intent registered on mount", async () => {
    const { ViroXRSceneNavigator, bridge } = load();
    const renderQuestPanel = jest.fn((_enter: () => void) => "panel");
    const out = ViroXRSceneNavigator.render({ initialScene: SCENE, renderQuestPanel }, null);
    expect(out).toBe("panel");
    await flush();
    const intent = bridge.getIntent();
    bridge.setVRActive(false);

    renderQuestPanel.mock.calls[0][0]();

    expect(mockLaunch).toHaveBeenCalledTimes(2);
    expect(bridge.isVRActive()).toBe(true);
    expect(bridge.getIntent()).toBe(intent);
  });

  it("renders a default panel whose button reopens it", async () => {
    const { ViroXRSceneNavigator } = load();
    const out = ViroXRSceneNavigator.render({ initialScene: SCENE }, null);
    await flush();

    const panel = out.type(out.props);
    panel.props.children.props.onPress();

    expect(mockLaunch).toHaveBeenCalledTimes(2);
  });
});

describe("ViroQuestEntryPoint", () => {
  it("clears the VR active flag when VRActivity's surface unmounts", () => {
    const { ViroQuestEntryPoint, bridge } = load();
    ViroQuestEntryPoint();
    expect(bridge.isVRActive()).toBe(true);

    mockCleanups.splice(0).forEach((cleanup) => cleanup());

    expect(bridge.isVRActive()).toBe(false);
  });

  it("keeps it set when a re-entry mounts before the finishing surface unmounts", () => {
    const { ViroQuestEntryPoint, bridge } = load();
    ViroQuestEntryPoint();
    const finishing = mockCleanups.splice(0);
    ViroQuestEntryPoint();
    const reentry = mockCleanups.splice(0);

    finishing.forEach((cleanup) => cleanup());
    expect(bridge.isVRActive()).toBe(true);

    reentry.forEach((cleanup) => cleanup());
    expect(bridge.isVRActive()).toBe(false);
  });
});
