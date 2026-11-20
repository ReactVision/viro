/**
 * The web host plays a scene's animations under the native host's rules: one
 * slot per asset, a play that may not be cut short queues the next, a loop
 * runs on_start once and never on_finish, and a model clip is looked up by its
 * embedded name.
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
jest.mock("../components/AR/ViroARPlaneSelector", () => ({
  ViroARPlaneSelector: "ViroARPlaneSelector",
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
jest.mock("../components/Animation/ViroAnimations", () => ({
  ViroAnimations: { registerAnimations: jest.fn() },
}));
jest.mock("../components/Material/ViroMaterials", () => ({
  ViroMaterials: { createMaterials: jest.fn(), updateShaderUniform: jest.fn() },
}));
jest.mock("../components/Web/ViroWebContext", () => {
  const sceneApi = {
    getNodeWorldPosition: () => null,
    setPhysicsWorld: () => {},
    setCollisionHandler: () => {},
  };
  return {
    useViroAR: () => ({ session: null }),
    useViroScene: () => sceneApi,
  };
});
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
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import { StudioARScene } from "../components/Studio/StudioARScene.web";
import { executeOnLoadFunction } from "../components/Studio/domain/sceneNavigationHandler";
import type {
  StudioAnimation,
  StudioAsset,
  StudioSceneFunction,
  StudioSceneResponse,
} from "../components/Studio/types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (cb: () => void) =>
  setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

const runSpy = executeOnLoadFunction as jest.Mock;

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

function animation(key: string, over: Partial<StudioAnimation> = {}): StudioAnimation {
  return {
    id: key,
    scene_id: "scene-a",
    animation_key: key,
    animation_source: "PROPERTY",
    clip_name: null,
    target_asset_id: "target",
    properties: {},
    duration_ms: 1000,
    delay_ms: 0,
    easing: "Linear",
    loop: false,
    interruptible: false,
    on_start_function: null,
    on_finish_function: null,
    ...over,
  } as StudioAnimation;
}

function play(anim: StudioAnimation): StudioSceneFunction {
  return {
    id: `play-${anim.id}`,
    function_type: "ANIMATION",
    animation: anim.id,
    scene_animation: anim,
  } as StudioSceneFunction;
}

function alertFn(id: string): StudioSceneFunction {
  return {
    id,
    function_type: "ALERT",
    scene_alert: { id: `${id}-a`, alert_title: id, alert_message: null },
  } as StudioSceneFunction;
}

function sceneData(
  assets: StudioAsset[],
  animations: StudioAnimation[],
  functions: StudioSceneFunction[] = []
): StudioSceneResponse {
  return {
    scene: {
      id: "scene-a",
      name: "A",
      belongs_to_project: "project-a",
      plane_detection: "NONE",
      plane_direction: null,
      on_load_function: null,
      physics_world_config: null,
      created_at: "",
      created_by: null,
      vps_location_id: null,
    },
    project: { id: "project-a", occlusion_mode: "NONE" },
    assets,
    collision_bindings: [],
    animations,
    functions,
    variables: [],
    meta: { request_id: "r" },
  } as StudioSceneResponse;
}

let renderer: ReactTestRenderer | undefined;

function render(data: StudioSceneResponse) {
  act(() => {
    renderer = TestRenderer.create(<StudioARScene sceneData={data} mode="3d" />);
  });
}

function node(assetId: string) {
  return renderer!.root.find(
    (n) =>
      n.type === "Viro3DObject" &&
      n.props.source?.uri === `https://example.test/${assetId}.glb`
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  runSpy.mockClear();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("StudioARScene (web) animations", () => {
  it("names a model clip by its embedded clip name", () => {
    render(
      sceneData(
        [model("target")],
        [
          animation("anim-walk", {
            animation_source: "MODEL_CLIP",
            clip_name: "Walk",
          }),
        ]
      )
    );
    expect(node("target").props.animation.name).toBe("Walk");
  });

  it("runs a loop's on_start once and never its on_finish", () => {
    render(
      sceneData(
        [model("target")],
        [
          animation("spin", {
            loop: true,
            on_start_function: "started",
            on_finish_function: "finished",
          }),
        ],
        [alertFn("started"), alertFn("finished")]
      )
    );
    const anim = () => node("target").props.animation;
    act(() => anim().onStart());
    act(() => anim().onFinish());
    act(() => anim().onStart());
    act(() => anim().onFinish());

    expect(runSpy.mock.calls.map((c) => c[0])).toEqual(["started"]);
  });

  it("queues a play behind one that may not be cut short", () => {
    const first = animation("first");
    const second = animation("second");
    render(
      sceneData(
        [
          model("target"),
          model("button-1", { scene_function: play(first) }),
          model("button-2", { scene_function: play(second) }),
        ],
        [first, second]
      )
    );
    act(() => node("target").props.onLoadEnd());

    act(() => node("button-1").props.onClick([0, 0, 0], 0));
    act(() => jest.advanceTimersByTime(20));
    expect(node("target").props.animation).toMatchObject({ name: "first", run: true });

    act(() => node("button-2").props.onClick([0, 0, 0], 0));
    act(() => jest.advanceTimersByTime(20));
    expect(node("target").props.animation.name).toBe("first");

    act(() => node("target").props.animation.onFinish());
    act(() => jest.advanceTimersByTime(20));
    expect(node("target").props.animation).toMatchObject({ name: "second", run: true });
  });

  it("lets an interruptible play be replaced at once", () => {
    const first = animation("first", { interruptible: true });
    const second = animation("second");
    render(
      sceneData(
        [
          model("target"),
          model("button-1", { scene_function: play(first) }),
          model("button-2", { scene_function: play(second) }),
        ],
        [first, second]
      )
    );
    act(() => node("target").props.onLoadEnd());
    act(() => node("button-1").props.onClick([0, 0, 0], 0));
    act(() => jest.advanceTimersByTime(20));

    act(() => node("button-2").props.onClick([0, 0, 0], 0));
    expect(node("target").props.animation).toMatchObject({
      name: "second",
      run: true,
      interruptible: true,
    });
  });
});
