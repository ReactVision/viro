/**
 * A Studio scene bound to a VPS location: its plane assets are in the
 * location's map frame, so they render under ViroVPSAnchor and nowhere else,
 * and only the scene on screen tracks the navigator's one map.
 */
jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Alert: { alert: jest.fn() },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  NativeModules: {},
  PixelRatio: { get: () => 1 },
  Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
  StatusBar: { currentHeight: 0 },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  View: "View",
  processColor: (c: any) => c,
  requireNativeComponent: (name: string) => name,
}));

const mockPlatform = { isQuest: false, isVisionOS: false };
jest.mock("../components/Utilities/ViroPlatform", () => ({
  get isQuest() {
    return mockPlatform.isQuest;
  },
  get isVisionOS() {
    return mockPlatform.isVisionOS;
  },
  isWeb: false,
}));

jest.mock("../components/ViroAmbientLight", () => ({
  ViroAmbientLight: "ViroAmbientLight",
}));
jest.mock("../components/ViroDirectionalLight", () => ({
  ViroDirectionalLight: "ViroDirectionalLight",
}));
jest.mock("../components/AR/ViroARImageMarker", () => ({
  ViroARImageMarker: "ViroARImageMarker",
}));
jest.mock("../components/AR/ViroARPlane", () => ({
  ViroARPlane: "ViroARPlane",
}));
jest.mock("../components/AR/ViroARPlaneSelector", () => ({
  ViroARPlaneSelector: "ViroARPlaneSelector",
}));
jest.mock("../components/AR/ViroARScene", () => ({
  ViroARScene: "ViroARScene",
}));
jest.mock("../components/AR/ViroVPSAnchor", () => ({
  ViroVPSAnchor: "ViroVPSAnchor",
}));
jest.mock("../components/ViroNode", () => ({ ViroNode: "ViroNode" }));
jest.mock("../components/ViroScene", () => ({ ViroScene: "ViroScene" }));
jest.mock("../components/ViroText", () => ({ ViroText: "ViroText" }));
jest.mock("../components/ViroController", () => ({
  ViroController: "ViroController",
}));
jest.mock("../components/Viro3DObject", () => ({
  Viro3DObject: "Viro3DObject",
}));
jest.mock("../components/ViroImage", () => ({ ViroImage: "ViroImage" }));
jest.mock("../components/ViroVideo", () => ({ ViroVideo: "ViroVideo" }));
jest.mock("../components/ViroSound", () => ({ ViroSound: "ViroSound" }));
jest.mock("../components/ViroSpatialSound", () => ({
  ViroSpatialSound: "ViroSpatialSound",
}));
jest.mock("../components/Material/ViroMaterials", () => ({
  ViroMaterials: { createMaterials: jest.fn(), updateShaderUniform: jest.fn() },
}));
jest.mock("../components/Utilities/VRModuleOpenXR", () => ({
  onRoomMoved: () => () => {},
}));
jest.mock("../components/Utilities/VRQuestNavigatorBridge", () => ({
  VRQuestNavigatorBridge: { onQuestError: () => () => {} },
}));
jest.mock("../components/Studio/StudioQuestAlertOverlay", () => ({
  StudioQuestAlertOverlay: "StudioQuestAlertOverlay",
}));
jest.mock("../components/Studio/StudioQuestLoadScene", () => ({
  StudioQuestLoadScene: "StudioQuestLoadScene",
}));
jest.mock("../components/Studio/StudioQuestSceneHudOverlay", () => ({
  StudioQuestSceneHudOverlay: "StudioQuestSceneHudOverlay",
}));
jest.mock("../components/Studio/StudioQuestText", () => ({
  StudioQuestText: "StudioQuestText",
}));
jest.mock("../components/Studio/StudioRecordingIndicator", () => ({
  StudioRecordingIndicator: "StudioRecordingIndicator",
}));
jest.mock("../components/Studio/StudioPlacementIndicator", () => ({
  StudioPlacementIndicator: "StudioPlacementIndicator",
}));
jest.mock("../components/Studio/StudioColocationIndicator", () => ({
  StudioColocationIndicator: "StudioColocationIndicator",
}));
jest.mock("../components/Studio/colocation/StudioColocationPeers", () => ({
  StudioColocationPeers: "StudioColocationPeers",
}));
jest.mock("../components/Studio/domain/triggerImageRegistry", () => ({
  registerTriggerImageTargets: (assets: { id: string }[]) =>
    new Map(assets.map((a) => [a.id, "marker-target"])),
  cleanupTriggerImageTargets: () => {},
}));
jest.mock("../components/Studio/domain/sceneNavigationHandler", () => {
  const actual = jest.requireActual(
    "../components/Studio/domain/sceneNavigationHandler"
  );
  return {
    ...actual,
    executeOnLoadFunction: jest.fn((...args: unknown[]) =>
      actual.executeOnLoadFunction(...args)
    ),
  };
});
jest.mock("../components/Studio/VRTStudioModule", () => ({
  VRTStudioModule: {
    rvGetAuthHeaders: jest.fn(),
    rvGetScene: jest.fn(),
    rvGetProject: jest.fn(),
  },
}));

// The navigator: a stack that renders every pushed scene, as the AR one does.
const mockArNav: Record<string, unknown> = {};
jest.mock("../components/ViroXRSceneNavigator", () => {
  const React = require("react");
  const ViroXRSceneNavigator = React.forwardRef((props: any, ref: any) => {
    const [stack, setStack] = React.useState([props.arInitialScene]);
    const nav = React.useMemo(
      () =>
        Object.assign(mockArNav, {
          push: (entry: unknown) => setStack((s: unknown[]) => [...s, entry]),
        }),
      []
    );
    React.useImperativeHandle(ref, () => ({ arSceneNavigator: nav }), [nav]);
    return stack.map((entry: any, i: number) =>
      React.createElement(entry.scene, {
        key: i,
        sceneNavigator: nav,
        arSceneNavigator: nav,
        ...entry.passProps,
      })
    );
  });
  return { ViroXRSceneNavigator };
});

const mockVps = { mounted: [] as any[], unmounted: [] as any[] };
jest.mock("../components/AR/ViroVPS", () => {
  const React = require("react");
  class ViroVPS extends React.Component {
    startTracking = jest.fn(async (locationId: string) => ({
      success: true,
      locationId,
    }));
    componentDidMount() {
      mockVps.mounted.push(this);
    }
    componentWillUnmount() {
      mockVps.unmounted.push(this);
    }
    render() {
      return null;
    }
  }
  return { ViroVPS };
});

import * as React from "react";
import { act } from "react";
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { StudioARScene } from "../components/Studio/StudioARScene";
import {
  StudioSceneNavigator,
  type StudioSceneNavigatorHandle,
} from "../components/Studio/StudioSceneNavigator";
import { executeOnLoadFunction } from "../components/Studio/domain/sceneNavigationHandler";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import {
  StudioVpsCoordinator,
  studioVpsEndpointAllowed,
  type StudioVpsStateEvent,
} from "../components/Studio/domain/vps";
import { VRTStudioModule } from "../components/Studio/VRTStudioModule";
import type {
  StudioAsset,
  StudioProximityBinding,
  StudioSceneFunction,
  StudioSceneResponse,
} from "../components/Studio/types";
import { Alert } from "react-native";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (cb: () => void) =>
  setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

const ENDPOINT = "https://vps.example.test";
const onLoadSpy = executeOnLoadFunction as jest.Mock;
const studio = VRTStudioModule as jest.Mocked<typeof VRTStudioModule>;

function model(id: string, over: Partial<StudioAsset> = {}): StudioAsset {
  return {
    id,
    name: id,
    asset_type_name: "3D-MODEL",
    file_url: `https://example.test/${id}.glb`,
    position_x: 0,
    position_y: 0,
    position_z: -1,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    scale: 1,
    is_draggable: false,
    hidden_on_load: false,
    tap_to_place: false,
    tap_to_place_order: null,
    trigger_image_url: null,
    material_config: null,
    physics_config: null,
    on_click_function: null,
    scene_function: null,
    ...over,
  } as StudioAsset;
}

const PLANE = model("plane", { position_z: 0.5 });
const MARKER = model("marker", {
  trigger_image_url: "https://example.test/m.png",
});
const PLACED = model("placed", { tap_to_place: true, tap_to_place_order: 1 });

function alertFn(id: string): StudioSceneFunction {
  return {
    id,
    function_type: "ALERT",
    scene_alert: { id: `${id}-a`, alert_title: "Hi", alert_message: null },
  } as StudioSceneFunction;
}

function soundFn(id: string, targetAssetId: string): StudioSceneFunction {
  return {
    id,
    function_type: "SOUND",
    scene_sound: {
      id: `${id}-s`,
      action: "PLAY",
      audio_asset_id: `${id}-clip`,
      audio_url: `https://example.test/${id}.mp3`,
      target_asset_id: targetAssetId,
      volume: 1,
      loop: true,
      stop_other_sounds: false,
    },
  } as StudioSceneFunction;
}

function sequenceFn(
  id: string,
  fns: StudioSceneFunction[]
): StudioSceneFunction {
  return {
    id,
    function_type: "SEQUENCE",
    scene_sequence: {
      id: `${id}-q`,
      name: null,
      steps: fns.map((fn, i) => ({
        id: `${id}-${i}`,
        step_order: i,
        step_type: "ACTION",
        duration_ms: null,
        function_id: fn.id,
        function: fn,
        advance_immediately: true,
      })),
    },
  } as StudioSceneFunction;
}

function navigateFn(id: string, to: string): StudioSceneFunction {
  return {
    id,
    function_type: "NAVIGATION",
    scene_navigation: { id: `${id}-n`, navigate_to: to },
  } as StudioSceneFunction;
}

function sceneData(
  over: Partial<StudioSceneResponse["scene"]> = {},
  rest: Partial<StudioSceneResponse> = {}
): StudioSceneResponse {
  return {
    scene: {
      id: "scene-a",
      name: "A",
      belongs_to_project: "project-of-scene",
      plane_detection: "NONE",
      plane_direction: null,
      on_load_function: null,
      physics_world_config: null,
      created_at: "",
      created_by: null,
      vps_location_id: "loc-1",
      ...over,
    },
    project: { id: "p", occlusion_mode: "NONE" },
    assets: [PLANE, MARKER, PLACED],
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    vps: { endpoint: ENDPOINT },
    meta: { request_id: "r" },
    ...rest,
  };
}

function proximity(
  id: string,
  targetAssetId: string,
  direction: StudioProximityBinding["direction"]
): StudioProximityBinding {
  return {
    id,
    scene_id: "scene-a",
    function_id: `${id}-fn`,
    target_asset_id: targetAssetId,
    distance: 1,
    direction,
    fire_mode: "repeating",
    scene_function: alertFn(`${id}-fn`),
  };
}

let renderer: ReactTestRenderer | undefined;

function render(
  element: React.ReactElement,
  options?: Parameters<typeof TestRenderer.create>[1]
) {
  act(() => {
    renderer = TestRenderer.create(element, options);
  });
  return renderer!;
}

function nodesOf(assetId: string): ReactTestInstance[] {
  return renderer!.root.findAll(
    (n) =>
      n.type === "Viro3DObject" &&
      n.props.source?.uri === `https://example.test/${assetId}.glb`
  );
}

function underAnchor(node: ReactTestInstance): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === "ViroVPSAnchor") return true;
  }
  return false;
}

function anchor(): ReactTestInstance | undefined {
  return renderer!.root.findAll((n) => n.type === "ViroVPSAnchor")[0];
}

function liveVps() {
  return mockVps.mounted.filter((v) => !mockVps.unmounted.includes(v));
}

function track(
  state: string,
  extra: Record<string, unknown> = {},
  vps = liveVps()[0]
) {
  act(() =>
    vps.props.onTrackingState({ state, locationId: "loc-1", ...extra })
  );
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPlatform.isQuest = false;
  mockPlatform.isVisionOS = false;
  mockVps.mounted = [];
  mockVps.unmounted = [];
  onLoadSpy.mockClear();
  (Alert.alert as jest.Mock).mockClear();
  studio.rvGetAuthHeaders.mockClear();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  const tree = renderer;
  renderer = undefined;
  if (tree) act(() => tree.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("StudioARScene bound to a VPS location", () => {
  it("tracks the scene's location with its VPS server, the scene's project and one credential", async () => {
    render(
      <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
    );
    const [vps] = liveVps();
    expect(vps.props.serverEndpoint).toBe(ENDPOINT);
    expect(vps.props.endpoint).toBeUndefined();
    expect(vps.props.arSceneNavigator).toBe(mockArNav);
    expect(vps.props.worldMesh).toBe(true);
    expect(vps.startTracking).toHaveBeenCalledWith("loc-1");

    studio.rvGetAuthHeaders.mockResolvedValueOnce({
      mode: "session",
      baseUrl: "https://platform.example",
      headers: {
        Authorization: "Bearer tok-1",
        "x-rv-client": "c",
        "x-region": "r",
      },
      projectId: "manifest-project",
    });
    await expect(vps.props.credentials()).resolves.toEqual({
      projectId: "project-of-scene",
      accessToken: "tok-1",
    });
    studio.rvGetAuthHeaders.mockResolvedValueOnce({
      mode: "api_key",
      baseUrl: "https://platform.example",
      headers: { "x-api-key": "key-1", "x-region": "r" },
      projectId: "manifest-project",
    });
    await expect(vps.props.credentials()).resolves.toEqual({
      projectId: "project-of-scene",
      apiKey: "key-1",
    });
  });

  it("wraps only the plane group in the anchor; marker and tap-to-place assets keep their frames", () => {
    const placementStore = new StudioPlacementStore();
    render(
      <StudioARScene
        sceneData={sceneData()}
        arSceneNavigator={mockArNav}
        placementStore={placementStore}
      />
    );
    act(() => placementStore.place("placed", [1, 0, -1]));

    expect(nodesOf("plane")).toHaveLength(1);
    expect(underAnchor(nodesOf("plane")[0])).toBe(true);
    // The map frame is real, so the authored Z is not clamped to -2.
    expect(nodesOf("plane")[0].props.position).toEqual([0, 0, 0.5]);

    expect(nodesOf("marker")).toHaveLength(1);
    expect(underAnchor(nodesOf("marker")[0])).toBe(false);
    expect(
      renderer!.root.findAll((n) => n.type === "ViroARImageMarker")
    ).toHaveLength(1);

    expect(nodesOf("placed")).toHaveLength(1);
    expect(underAnchor(nodesOf("placed")[0])).toBe(false);
  });

  it("shows the anchor only while tracking", () => {
    render(
      <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
    );
    expect(anchor()!.props.visible).toBe(false);
    track("searching");
    track("mapLoaded");
    expect(anchor()!.props.visible).toBe(false);
    track("tracking");
    expect(anchor()!.props.visible).toBe(true);
    track("lost");
    expect(anchor()!.props.visible).toBe(false);
  });

  it("never renders the plane group outside the anchor, not on the tracking fallback and not on error", () => {
    render(
      <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
    );
    track("error", {
      error: "boom",
      errorDetail: { code: "NETWORK_ERROR", status: null, message: "boom" },
    });
    // Past the 6 s window after which a NONE scene shows its assets anyway.
    act(() => jest.advanceTimersByTime(7000));
    expect(nodesOf("plane").every(underAnchor)).toBe(true);
    expect(anchor()!.props.visible).toBe(false);
  });

  it.each([
    ["Meta Quest", "isQuest"],
    ["Apple Vision Pro", "isVisionOS"],
  ] as const)(
    "renders no plane group and reports unsupported on %s",
    (_name, flag) => {
      mockPlatform[flag] = true;
      const events: StudioVpsStateEvent[] = [];
      const coordinator = new StudioVpsCoordinator();
      coordinator.onStateChange = (e) => events.push(e);
      render(<StudioARScene sceneData={sceneData()} vps={coordinator} />);
      act(() => jest.advanceTimersByTime(7000));

      expect(nodesOf("plane")).toHaveLength(0);
      expect(anchor()).toBeUndefined();
      expect(liveVps()).toHaveLength(0);
      expect(events).toEqual([
        {
          sceneId: "scene-a",
          locationId: "loc-1",
          state: "unsupported",
          error: expect.objectContaining({ code: "UNSUPPORTED", status: null }),
        },
      ]);
    }
  );

  it("hides the plane group when the navigator cannot track, as <ViroVPS> reports", () => {
    render(<StudioARScene sceneData={sceneData()} arSceneNavigator={{}} />);
    track("unsupported", {
      error: "This navigator does not expose loadVPSMap",
      errorDetail: { code: "UNSUPPORTED", status: null, message: "x" },
    });
    act(() => jest.advanceTimersByTime(7000));
    expect(nodesOf("plane").every(underAnchor)).toBe(true);
    expect(anchor()!.props.visible).toBe(false);
  });

  it("tracks a bound scene that came without a VPS server, leaving <ViroVPS> to ask Studio", () => {
    const events: StudioVpsStateEvent[] = [];
    const coordinator = new StudioVpsCoordinator();
    coordinator.onStateChange = (e) => events.push(e);
    render(
      <StudioARScene
        sceneData={sceneData({}, { vps: undefined })}
        vps={coordinator}
        arSceneNavigator={mockArNav}
      />
    );
    act(() => jest.advanceTimersByTime(7000));
    const [vps] = liveVps();
    expect(vps.props.serverEndpoint).toBeUndefined();
    expect(vps.startTracking).toHaveBeenCalledWith("loc-1");
    expect(nodesOf("plane").every(underAnchor)).toBe(true);
    expect(events).toEqual([]);
  });

  it("keeps the plane group under the anchor while a shared co-location session runs", () => {
    const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const frame = {
      phase: "shared",
      role: "host",
      authority: true,
      needsOrigin: false,
      sceneId: "scene-a",
      sceneMount: 1,
      location: IDENTITY,
      origin: IDENTITY,
      sceneToWorld: IDENTITY,
      worldToScene: IDENTITY,
    };
    const colocation = {
      subscribe: () => () => {},
      getFrame: () => frame,
      claimSceneMount: () => 1,
      attachScene: jest.fn(),
      detachScene: jest.fn(),
      isCurrentScene: () => true,
      readPeers: () => [],
      publishCameraPose: jest.fn(),
      shareAnimation: jest.fn(),
      proposeOrigin: jest.fn(),
    };
    render(
      <StudioARScene
        sceneData={sceneData()}
        arSceneNavigator={mockArNav}
        colocation={colocation as any}
      />
    );
    act(() => jest.advanceTimersByTime(7000));
    expect(nodesOf("plane")).toHaveLength(1);
    expect(underAnchor(nodesOf("plane")[0])).toBe(true);
  });

  it.each([
    ["renders", false, undefined],
    ["does not render", true, ["plane"]],
  ])(
    "hands a shared session the plane assets it %s, whose remote PLAYs it skips",
    (_name, onVisionPro, unrendered) => {
      mockPlatform.isVisionOS = onVisionPro;
      const data = sceneData();
      const frame = {
        phase: "off",
        role: null,
        authority: false,
        needsOrigin: false,
        sceneId: null,
        sceneMount: null,
        location: null,
        origin: null,
        sceneToWorld: null,
        worldToScene: null,
      };
      const attachScene = jest.fn();
      const colocation = {
        subscribe: () => () => {},
        getFrame: () => frame,
        claimSceneMount: () => 1,
        attachScene,
        detachScene: jest.fn(),
      };
      render(
        <StudioARScene
          sceneData={data}
          arSceneNavigator={mockArNav}
          colocation={colocation as any}
        />
      );
      const hooks = attachScene.mock.calls[0][2];
      expect(hooks.unrenderedAssetIds && [...hooks.unrenderedAssetIds]).toEqual(
        unrendered
      );
    }
  );

  it("renders a sound at a plane asset inside the anchor, and one at a marker asset outside it", () => {
    const sounds = [
      soundFn("at-plane", "plane"),
      soundFn("at-marker", "marker"),
    ];
    const data = sceneData(
      { on_load_function: "on-load" },
      { functions: [sequenceFn("on-load", sounds), ...sounds] }
    );
    render(<StudioARScene sceneData={data} arSceneNavigator={mockArNav} />);
    track("tracking");
    const spatial = renderer!.root.findAll(
      (n) => n.type === "ViroSpatialSound"
    );
    const at = (id: string) =>
      spatial.find(
        (n) => n.props.source.uri === `https://example.test/${id}.mp3`
      )!;
    expect(spatial).toHaveLength(2);
    expect(underAnchor(at("at-plane"))).toBe(true);
    expect(underAnchor(at("at-marker"))).toBe(false);
  });

  it("runs on_load at the first tracking, once", () => {
    const data = sceneData(
      { on_load_function: "on-load" },
      { functions: [alertFn("on-load")] }
    );
    render(<StudioARScene sceneData={data} arSceneNavigator={mockArNav} />);
    track("searching");
    track("mapLoaded");
    act(() => jest.advanceTimersByTime(7000));
    expect(onLoadSpy).not.toHaveBeenCalled();

    track("tracking");
    expect(onLoadSpy).toHaveBeenCalledTimes(1);
    expect(onLoadSpy.mock.calls[0][0]).toBe("on-load");

    track("lost");
    track("tracking");
    expect(onLoadSpy).toHaveBeenCalledTimes(1);
  });

  it("does not run on_load when tracking never starts", () => {
    const data = sceneData(
      { on_load_function: "on-load" },
      { functions: [alertFn("on-load")] }
    );
    render(<StudioARScene sceneData={data} arSceneNavigator={mockArNav} />);
    track("error", {
      errorDetail: { code: "NO_ASSET", status: 404, message: "no map" },
    });
    act(() => jest.advanceTimersByTime(60000));
    expect(onLoadSpy).not.toHaveBeenCalled();
  });

  it("still runs an unbound scene's on_load at mount", () => {
    const data = sceneData(
      { on_load_function: "on-load", vps_location_id: null },
      { functions: [alertFn("on-load")], vps: undefined }
    );
    render(<StudioARScene sceneData={data} arSceneNavigator={mockArNav} />);
    expect(onLoadSpy).toHaveBeenCalledTimes(1);
    expect(anchor()).toBeUndefined();
    expect(nodesOf("plane")).toHaveLength(0);
    act(() => jest.advanceTimersByTime(7000));
    expect(underAnchor(nodesOf("plane")[0])).toBe(false);
  });

  describe("proximity on a plane asset", () => {
    // Before VPS places the anchor, a node under it reads its map position as
    // a world one.
    let targetAt: [number, number, number];

    function renderWith(bindings: StudioProximityBinding[]) {
      targetAt = [0, 0, -3];
      render(
        <StudioARScene
          sceneData={sceneData(
            {},
            {
              assets: [model("plane", { position_z: -3 })],
              proximity_bindings: bindings,
            }
          )}
          arSceneNavigator={mockArNav}
        />,
        {
          createNodeMock: (el) =>
            el.type === "Viro3DObject"
              ? { getTransformAsync: async () => ({ position: targetAt }) }
              : null,
        }
      );
    }

    function cameraAt(z: number) {
      act(() => {
        jest.advanceTimersByTime(200);
        renderer!.root
          .findAll((n) => n.type === "ViroARScene")[0]
          .props.onCameraTransformUpdate({
            position: [0, 0, z],
            forward: [0, 0, -1],
            up: [0, 1, 0],
          });
      });
    }

    it("waits for tracking, then fires against the placed position", async () => {
      renderWith([proximity("near", "plane", "entering")]);
      await flush();
      cameraAt(0);
      cameraAt(-1.5);
      cameraAt(-2.5);
      expect(Alert.alert).not.toHaveBeenCalled();

      targetAt = [0, 0, -10];
      track("tracking");
      await flush();
      cameraAt(-2.5);
      cameraAt(-9.5);
      expect(Alert.alert).toHaveBeenCalledTimes(1);
    });

    it("primes again when tracking starts, never against the position cached before", async () => {
      renderWith([proximity("leave", "plane", "exiting")]);
      await flush();
      cameraAt(-2.5);
      targetAt = [0, 0, -10];
      track("tracking");
      // Before the refresh lands, the old cache says the user is inside.
      cameraAt(-2.5);
      await flush();
      cameraAt(-2.5);
      expect(Alert.alert).not.toHaveBeenCalled();

      track("lost");
      targetAt = [0, 0, -2.5];
      track("tracking");
      await flush();
      cameraAt(-2.5);
      cameraAt(-6);
      expect(Alert.alert).toHaveBeenCalledTimes(1);
    });

    it("follows the anchor as it moves while tracking", async () => {
      renderWith([proximity("near", "plane", "entering")]);
      targetAt = [0, 0, -10];
      track("tracking");
      await flush();
      cameraAt(-5);

      targetAt = [0, 0, -5.5];
      cameraAt(-5);
      expect(Alert.alert).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(1000));
      await flush();
      cameraAt(-5);
      expect(Alert.alert).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ["Apple Vision Pro", () => (mockPlatform.isVisionOS = true), sceneData()],
  ])(
    "skips a PLAY at a plane asset it does not render (%s), and the sequence goes on",
    (_name, setUp, data) => {
      setUp();
      const playAtPlane = {
        ...soundFn("at-plane", "plane"),
        scene_sound: {
          ...soundFn("at-plane", "plane").scene_sound!,
          loop: false,
        },
      } as StudioSceneFunction;
      const tap = sequenceFn("tap", [playAtPlane, alertFn("after")]);
      tap.scene_sequence!.steps[0].advance_immediately = false;
      const marker = model("marker", {
        trigger_image_url: "https://example.test/m.png",
        scene_function: tap,
      });
      render(
        <StudioARScene
          sceneData={{ ...data, assets: [PLANE, marker] }}
          arSceneNavigator={mockArNav}
        />
      );
      act(() => nodesOf("marker")[0].props.onClick([0, 0, 0], 0));
      act(() => jest.advanceTimersByTime(10));

      expect(
        renderer!.root.findAll((n) => n.type === "ViroSpatialSound")
      ).toHaveLength(0);
      expect(Alert.alert).toHaveBeenCalledTimes(1);
    }
  );

  describe("retrying startTracking", () => {
    const failure = (code: string, status: number | null) => ({
      errorDetail: { code, status, message: code },
    });

    it("retries a transient failure with a growing delay while the scene is on screen", () => {
      render(
        <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
      );
      const [vps] = liveVps();
      expect(vps.startTracking).toHaveBeenCalledTimes(1);

      track("error", failure("NETWORK_ERROR", null));
      act(() => jest.advanceTimersByTime(1999));
      expect(vps.startTracking).toHaveBeenCalledTimes(1);
      act(() => jest.advanceTimersByTime(1));
      expect(vps.startTracking).toHaveBeenCalledTimes(2);
      expect(vps.startTracking).toHaveBeenLastCalledWith("loc-1");

      track("searching");
      track("error", failure("HTTP_ERROR", 503));
      act(() => jest.advanceTimersByTime(3999));
      expect(vps.startTracking).toHaveBeenCalledTimes(2);
      act(() => jest.advanceTimersByTime(1));
      expect(vps.startTracking).toHaveBeenCalledTimes(3);

      // Tracking resets the delay; an idle means the map went away.
      track("tracking");
      track("idle");
      act(() => jest.advanceTimersByTime(2000));
      expect(vps.startTracking).toHaveBeenCalledTimes(4);
    });

    it.each([
      ["NO_ASSET", 404],
      ["PAID_PLAN_REQUIRED", 402],
      ["HTTP_ERROR", 401],
      ["mfa_required", 403],
      ["LOCALIZATION_UNAVAILABLE", null],
    ] as const)("does not retry %s (%s)", (code, status) => {
      render(
        <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
      );
      const [vps] = liveVps();
      track("error", failure(code, status));
      act(() => jest.advanceTimersByTime(120000));
      expect(vps.startTracking).toHaveBeenCalledTimes(1);
    });

    it("retries a map that keeps failing four times, then leaves it to the host's Retry", () => {
      render(
        <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
      );
      const [vps] = liveVps();
      for (const state of ["error", "idle", "error", "error"] as const) {
        track(state, state === "error" ? failure("MAP_LOAD_FAILED", null) : {});
        act(() => jest.advanceTimersByTime(60000));
        track("searching");
      }
      expect(vps.startTracking).toHaveBeenCalledTimes(5);
      track("error", failure("MAP_LOAD_FAILED", null));
      act(() => jest.advanceTimersByTime(120000));
      expect(vps.startTracking).toHaveBeenCalledTimes(5);
      // a failure on the way to the map is still retried
      track("error", failure("NETWORK_ERROR", null));
      act(() => jest.advanceTimersByTime(60000));
      expect(vps.startTracking).toHaveBeenCalledTimes(6);
    });

    it("stops retrying once the scene unmounts", () => {
      render(
        <StudioARScene sceneData={sceneData()} arSceneNavigator={mockArNav} />
      );
      const [vps] = liveVps();
      track("error", failure("MAP_LOAD_FAILED", null));
      act(() => renderer!.unmount());
      renderer = undefined;
      act(() => jest.advanceTimersByTime(120000));
      expect(vps.startTracking).toHaveBeenCalledTimes(1);
    });
  });

  it("leaves out a VPS server that is not https, so no credential goes to it", () => {
    render(
      <StudioARScene
        sceneData={sceneData(
          {},
          { vps: { endpoint: "http://vps.example.test" } }
        )}
        arSceneNavigator={mockArNav}
      />
    );
    const [vps] = liveVps();
    expect(vps.props.serverEndpoint).toBeUndefined();
    expect(vps.startTracking).toHaveBeenCalledWith("loc-1");
  });
});

describe("studioVpsEndpointAllowed", () => {
  it.each([
    "https://vps.reactvision.xyz",
    "HTTPS://vps.example.test:8443/base",
    "http://localhost:8788",
    "http://127.0.0.1:8788",
    "http://10.0.0.5",
    "http://172.16.4.2:8788",
    "http://192.168.1.20:8788/",
    "http://[::1]:8788",
    "http://[fd12:3456::1]:8788",
  ])("allows %s", (endpoint) => {
    expect(studioVpsEndpointAllowed(endpoint)).toBe(true);
  });

  it.each([
    "http://vps.reactvision.xyz",
    "http://gpu-p100:8788",
    "http://8.8.8.8",
    "http://172.32.0.1",
    "http://010.0.0.1",
    "http://10.0.0.1.example.com",
    "http://localhost.example.com",
    "http://user@localhost@vps.example.com",
    "http://vps.example.com\\@localhost",
    "http://[2001:db8::1]",
    "ws://localhost:8788",
    "vps.example.test",
    "https://",
    "",
  ])("refuses %s", (endpoint) => {
    expect(studioVpsEndpointAllowed(endpoint)).toBe(false);
  });
});

describe("StudioSceneNavigator onVpsStateChange", () => {
  const SCENE_B = sceneData(
    { id: "scene-b", name: "B", vps_location_id: "loc-2" },
    { assets: [model("plane-b")] }
  );

  function navigator(
    events: StudioVpsStateEvent[],
    first: StudioSceneResponse
  ) {
    studio.rvGetScene.mockImplementation(async (id: string) => ({
      success: true,
      data: JSON.stringify(id === "scene-b" ? SCENE_B : first),
    }));
    return render(
      <StudioSceneNavigator
        sceneId={first.scene.id}
        onVpsStateChange={(e) => events.push(e)}
      />
    );
  }

  async function load() {
    act(() => jest.advanceTimersByTime(1));
    await flush();
  }

  it("reports the scene on screen's states with its ids and the error detail", async () => {
    const events: StudioVpsStateEvent[] = [];
    navigator(events, sceneData());
    await load();

    track("searching");
    track("tracking");
    track("error", {
      error: "HTTP 402",
      errorDetail: {
        code: "PAID_PLAN_REQUIRED",
        status: 402,
        message: "HTTP 402",
      },
    });
    expect(events).toEqual([
      { sceneId: "scene-a", locationId: "loc-1", state: "searching" },
      { sceneId: "scene-a", locationId: "loc-1", state: "tracking" },
      {
        sceneId: "scene-a",
        locationId: "loc-1",
        state: "error",
        error: { code: "PAID_PLAN_REQUIRED", status: 402, message: "HTTP 402" },
      },
    ]);
  });

  it("hands the map to a scene NAVIGATE pushes: the covered scene stops and reports idle first", async () => {
    const events: StudioVpsStateEvent[] = [];
    const first = sceneData(
      { on_load_function: "go" },
      { functions: [navigateFn("go", "scene-b")] }
    );
    navigator(events, first);
    await load();
    const [vpsA] = liveVps();
    expect(vpsA.startTracking).toHaveBeenCalledWith("loc-1");

    // on_load navigates, at the first tracking.
    track("tracking", {}, vpsA);
    await flush();

    expect(mockVps.unmounted).toContain(vpsA);
    const live = liveVps();
    expect(live).toHaveLength(1);
    expect(live[0].startTracking).toHaveBeenCalledWith("loc-2");

    track("searching", { locationId: "loc-2" }, live[0]);
    // A late event from the covered scene reports nothing.
    act(() =>
      vpsA.props.onTrackingState({ state: "lost", locationId: "loc-1" })
    );
    expect(events.map((e) => [e.sceneId, e.state])).toEqual([
      ["scene-a", "tracking"],
      ["scene-a", "idle"],
      ["scene-b", "searching"],
    ]);
  });
});

describe("StudioSceneNavigator vpsLocalization", () => {
  it("starts the scene on screen in the host's mode and restarts it when the mode changes", async () => {
    studio.rvGetScene.mockImplementation(async () => ({
      success: true,
      data: JSON.stringify(sceneData()),
    }));
    const tree = render(
      <StudioSceneNavigator sceneId="scene-a" vpsLocalization="server" />
    );
    act(() => jest.advanceTimersByTime(1));
    await flush();
    const [vps] = liveVps();
    expect(vps.props.localization).toBe("server");
    expect(vps.startTracking).toHaveBeenCalledTimes(1);

    act(() =>
      tree.update(
        <StudioSceneNavigator sceneId="scene-a" vpsLocalization="device" />
      )
    );
    await flush();
    expect(liveVps()).toEqual([vps]);
    expect(vps.props.localization).toBe("device");
    expect(vps.startTracking).toHaveBeenCalledTimes(2);
    expect(vps.startTracking).toHaveBeenLastCalledWith("loc-1");
  });
});

describe("retryVps", () => {
  const failure = (code: string, status: number | null) => ({
    errorDetail: { code, status, message: code },
  });

  async function navigator(first: StudioSceneResponse) {
    studio.rvGetScene.mockImplementation(async () => ({
      success: true,
      data: JSON.stringify(first),
    }));
    const ref = React.createRef<StudioSceneNavigatorHandle>();
    render(<StudioSceneNavigator ref={ref} sceneId={first.scene.id} />);
    act(() => jest.advanceTimersByTime(1));
    await flush();
    return ref.current!;
  }

  it("restarts the scene on screen at once after an error the automatic retry leaves alone", async () => {
    const handle = await navigator(sceneData());
    const [vps] = liveVps();
    expect(vps.startTracking).toHaveBeenCalledTimes(1);
    expect(handle.retryVps()).toBe(false);
    track("tracking");
    expect(handle.retryVps()).toBe(false);

    track("error", failure("NO_ASSET", 404));
    act(() => jest.advanceTimersByTime(120000));
    expect(vps.startTracking).toHaveBeenCalledTimes(1);
    expect(handle.retryVps()).toBe(true);
    expect(vps.startTracking).toHaveBeenCalledTimes(2);
    expect(vps.startTracking).toHaveBeenLastCalledWith("loc-1");
    // Searching again until <ViroVPS> reports otherwise.
    expect(handle.retryVps()).toBe(false);
  });

  it("takes the place of a scheduled automatic retry, and restarts after an idle", async () => {
    const handle = await navigator(sceneData());
    const [vps] = liveVps();
    track("error", failure("NETWORK_ERROR", null));
    expect(handle.retryVps()).toBe(true);
    act(() => jest.advanceTimersByTime(60000));
    expect(vps.startTracking).toHaveBeenCalledTimes(2);

    track("tracking");
    track("idle");
    expect(handle.retryVps()).toBe(true);
    expect(vps.startTracking).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["an unbound scene", () => {}, sceneData({ vps_location_id: null })],
    ["Meta Quest", () => (mockPlatform.isQuest = true), sceneData()],
  ])("has nothing to restart for %s", (_name, setUp, data) => {
    setUp();
    const coordinator = new StudioVpsCoordinator();
    render(
      <StudioARScene
        sceneData={data}
        vps={coordinator}
        arSceneNavigator={mockArNav}
      />
    );
    act(() => jest.advanceTimersByTime(7000));
    expect(coordinator.retry()).toBe(false);
    expect(liveVps()).toHaveLength(0);
  });

  it("asks only the scene on screen", () => {
    const coordinator = new StudioVpsCoordinator();
    expect(coordinator.retry()).toBe(false);
    const covered = jest.fn(() => true);
    const onScreen = jest.fn(() => false);
    coordinator.claim(null, () => {}, covered);
    const top = coordinator.claim(null, () => {}, onScreen);
    expect(coordinator.retry()).toBe(false);
    expect(onScreen).toHaveBeenCalledTimes(1);
    expect(covered).not.toHaveBeenCalled();
    top.release();
    expect(coordinator.retry()).toBe(true);
    expect(covered).toHaveBeenCalledTimes(1);
  });
});
