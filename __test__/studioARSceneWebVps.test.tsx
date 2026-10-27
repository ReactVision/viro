/**
 * The web Studio host and a scene bound to a VPS location. A browser cannot
 * track the location's map, so the scene's plane assets, which are in that
 * map's frame, render nowhere, and nothing is measured from or played at them.
 */
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  NativeModules: {},
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  processColor: (c: any) => c,
}));
jest.mock("../components/ViroAmbientLight.web", () => ({
  ViroAmbientLight: "ViroAmbientLight",
}));
jest.mock("../components/ViroDirectionalLight.web", () => ({
  ViroDirectionalLight: "ViroDirectionalLight",
}));
jest.mock("../components/AR/ViroARPlane.web", () => ({
  ViroARPlane: "ViroARPlane",
}));
jest.mock("../components/AR/ViroARScene.web", () => ({
  ViroARScene: "ViroARScene",
}));
jest.mock("../components/ViroScene.web", () => ({ ViroScene: "ViroScene" }));
jest.mock("../components/ViroText.web", () => ({ ViroText: "ViroText" }));
jest.mock("../components/Viro3DObject", () => ({
  Viro3DObject: "Viro3DObject",
}));
jest.mock("../components/ViroImage", () => ({ ViroImage: "ViroImage" }));
jest.mock("../components/ViroText", () => ({ ViroText: "ViroText" }));
jest.mock("../components/ViroVideo", () => ({ ViroVideo: "ViroVideo" }));
jest.mock("../components/ViroSound", () => ({ ViroSound: "ViroSound" }));
jest.mock("../components/ViroSpatialSound", () => ({
  ViroSpatialSound: "ViroSpatialSound",
}));
jest.mock("../components/Material/ViroMaterials", () => ({
  ViroMaterials: { createMaterials: jest.fn(), updateShaderUniform: jest.fn() },
}));
const mockSession = {
  cameraPose: { position: [0, 0, 0], quaternion: [0, 0, 0, 1] },
};
jest.mock("../components/Web/ViroWebContext", () => {
  const sceneApi = {
    getNodeWorldPosition: () => null,
    setPhysicsWorld: () => {},
    setCollisionHandler: () => {},
  };
  return {
    useViroAR: () => ({ session: mockSession }),
    useViroScene: () => sceneApi,
  };
});
jest.mock("../components/Studio/domain/proximityBindingsRuntime", () => ({
  evaluateProximityBindings: jest.fn(),
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

import * as React from "react";
import { act } from "react";
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { Alert } from "react-native";
import { StudioARScene } from "../components/Studio/StudioARScene.web";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import { evaluateProximityBindings } from "../components/Studio/domain/proximityBindingsRuntime";
import { executeOnLoadFunction } from "../components/Studio/domain/sceneNavigationHandler";
import type {
  StudioAsset,
  StudioProximityBinding,
  StudioSceneFunction,
  StudioSceneResponse,
} from "../components/Studio/types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (cb: () => void) =>
  setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

const onLoadSpy = executeOnLoadFunction as jest.Mock;
const evaluateSpy = evaluateProximityBindings as jest.Mock;

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

function alertFn(id: string): StudioSceneFunction {
  return {
    id,
    function_type: "ALERT",
    scene_alert: { id: `${id}-a`, alert_title: "Hi", alert_message: null },
  } as StudioSceneFunction;
}

const PLAY_AT_PLANE = {
  id: "play",
  function_type: "SOUND",
  scene_sound: {
    id: "play-s",
    action: "PLAY",
    audio_asset_id: "clip",
    audio_url: "https://example.test/clip.mp3",
    target_asset_id: "plane",
    volume: 1,
    loop: false,
    stop_other_sounds: false,
  },
} as StudioSceneFunction;

function tapSequence(): StudioSceneFunction {
  const steps = [PLAY_AT_PLANE, alertFn("after")].map((fn, i) => ({
    id: `tap-${i}`,
    step_order: i,
    step_type: "ACTION",
    duration_ms: null,
    function_id: fn.id,
    function: fn,
    advance_immediately: false,
  }));
  return {
    id: "tap",
    function_type: "SEQUENCE",
    scene_sequence: { id: "tap-q", name: null, steps },
  } as StudioSceneFunction;
}

function proximity(id: string, targetAssetId: string): StudioProximityBinding {
  return {
    id,
    scene_id: "scene-a",
    function_id: `${id}-fn`,
    target_asset_id: targetAssetId,
    distance: 1,
    direction: "entering",
    fire_mode: "repeating",
    scene_function: alertFn(`${id}-fn`),
  };
}

function sceneData(
  vpsLocationId: string | null,
  rest: Partial<StudioSceneResponse> = {}
): StudioSceneResponse {
  return {
    scene: {
      id: "scene-a",
      name: "A",
      belongs_to_project: "project-a",
      plane_detection: "NONE",
      plane_direction: null,
      on_load_function: "on-load",
      physics_world_config: null,
      created_at: "",
      created_by: null,
      vps_location_id: vpsLocationId,
    },
    project: { id: "project-a", occlusion_mode: "NONE" },
    assets: [
      model("plane"),
      model("placed", {
        tap_to_place: true,
        tap_to_place_order: 1,
        scene_function: tapSequence(),
      }),
    ],
    collision_bindings: [],
    proximity_bindings: [
      proximity("near-plane", "plane"),
      proximity("near-placed", "placed"),
    ],
    animations: [],
    functions: [alertFn("on-load")],
    variables: [],
    meta: { request_id: "r" },
    ...rest,
  };
}

let renderer: ReactTestRenderer | undefined;

function render(data: StudioSceneResponse) {
  const placementStore = new StudioPlacementStore();
  act(() => {
    renderer = TestRenderer.create(
      <StudioARScene
        sceneData={data}
        mode="ar"
        placementStore={placementStore}
      />
    );
  });
  act(() => placementStore.place("placed", [1, 0, -1]));
}

function nodesOf(assetId: string): ReactTestInstance[] {
  return renderer!.root.findAll(
    (n) =>
      n.type === "Viro3DObject" &&
      n.props.source?.uri === `https://example.test/${assetId}.glb`
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  onLoadSpy.mockClear();
  evaluateSpy.mockClear();
  (Alert.alert as jest.Mock).mockClear();
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

describe("StudioARScene (web) and a scene bound to a VPS location", () => {
  it("renders none of its plane assets, and keeps its tap-to-place ones", () => {
    render(sceneData("loc-1"));
    expect(nodesOf("plane")).toHaveLength(0);
    expect(nodesOf("placed")).toHaveLength(1);
  });

  it("does not run its on_load function, which waits for tracking", () => {
    render(sceneData("loc-1"));
    expect(onLoadSpy).not.toHaveBeenCalled();
  });

  it("measures proximity only to assets it renders", () => {
    render(sceneData("loc-1"));
    act(() => jest.advanceTimersByTime(200));
    expect(evaluateSpy).toHaveBeenCalled();
    const { bindings } = evaluateSpy.mock.calls[0][0];
    expect(bindings.map((b: StudioProximityBinding) => b.id)).toEqual([
      "near-placed",
    ]);
  });

  it("skips a PLAY at a plane asset, and the sequence goes on", () => {
    render(sceneData("loc-1"));
    act(() => nodesOf("placed")[0].props.onClick([0, 0, 0], 0));
    act(() => jest.advanceTimersByTime(10));
    expect(
      renderer!.root.findAll(
        (n) => n.type === "ViroSpatialSound" || n.type === "ViroSound"
      )
    ).toHaveLength(0);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
  });

  it("leaves an unbound scene's plane assets, on_load, proximity and sounds alone", () => {
    render(sceneData(null));
    expect(nodesOf("plane")).toHaveLength(1);
    expect(onLoadSpy).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(200));
    const { bindings } = evaluateSpy.mock.calls[0][0];
    expect(bindings).toHaveLength(2);
    act(() => nodesOf("placed")[0].props.onClick([0, 0, 0], 0));
    expect(
      renderer!.root.findAll((n) => n.type === "ViroSpatialSound")
    ).toHaveLength(1);
  });
});
