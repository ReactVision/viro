/**
 * In AR a plane_detection NONE scene's assets wait for tracking to first reach
 * Normal, or the fallback window, under the native host's rule.
 */
let mockTrackingState = 1;
let mockPlayback = false;
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
    useViroAR: () => ({ session: null, trackingState: mockTrackingState, playback: mockPlayback }),
    useViroScene: () => sceneApi,
  };
});

import * as React from "react";
import { act } from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import { ViroTrackingState } from "@reactvision/viro-web-renderer";
import { StudioARScene } from "../components/Studio/StudioARScene.web";
import { TRACKING_GATE_FALLBACK_MS } from "../components/Studio/domain/trackingGate";
import type { StudioAsset, StudioSceneResponse } from "../components/Studio/types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function model(id: string): StudioAsset {
  return {
    id,
    name: id,
    asset_type_name: "3D-MODEL",
    file_url: `https://example.test/${id}.glb`,
    position_x: 0,
    position_y: 0,
    position_z: 0,
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
  } as StudioAsset;
}

function sceneData(planeDetection: string): StudioSceneResponse {
  return {
    scene: {
      id: "scene-a",
      name: "A",
      belongs_to_project: "project-a",
      plane_detection: planeDetection,
      plane_direction: "Horizontal",
      on_load_function: null,
      physics_world_config: null,
      created_at: "",
      created_by: null,
      vps_location_id: null,
    },
    project: { id: "project-a", occlusion_mode: "NONE" },
    assets: [model("chair")],
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    meta: { request_id: "r" },
  } as unknown as StudioSceneResponse;
}

let renderer: ReactTestRenderer | undefined;

function render(data: StudioSceneResponse, mode: "ar" | "3d" = "ar") {
  act(() => {
    renderer = TestRenderer.create(<StudioARScene sceneData={data} mode={mode} />);
  });
}

function rerender(data: StudioSceneResponse) {
  act(() => renderer!.update(<StudioARScene sceneData={data} mode="ar" />));
}

const models = () => renderer!.root.findAll((n) => n.type === "Viro3DObject");

beforeEach(() => {
  jest.useFakeTimers();
  mockTrackingState = ViroTrackingState.Unavailable;
  mockPlayback = false;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("StudioARScene (web) tracking gate", () => {
  it("holds a NONE scene's assets until tracking first reaches Normal", () => {
    const data = sceneData("NONE");
    render(data);
    expect(models()).toHaveLength(0);
    mockTrackingState = ViroTrackingState.Normal;
    rerender(data);
    expect(models()).toHaveLength(1);
    mockTrackingState = ViroTrackingState.Limited;
    rerender(data);
    expect(models()).toHaveLength(1);
  });

  it("shows them after the fallback window when tracking never settles", () => {
    render(sceneData("NONE"));
    act(() => jest.advanceTimersByTime(TRACKING_GATE_FALLBACK_MS - 1));
    expect(models()).toHaveLength(0);
    act(() => jest.advanceTimersByTime(1));
    expect(models()).toHaveLength(1);
  });

  it("does not hold a replayed recording", () => {
    mockPlayback = true;
    render(sceneData("NONE"));
    expect(models()).toHaveLength(1);
  });

  it("does not hold plane scenes or the 3D viewer", () => {
    render(sceneData("AUTOMATIC"));
    expect(renderer!.root.findAll((n) => n.type === "ViroARPlane")).toHaveLength(1);
    act(() => renderer!.unmount());
    render(sceneData("NONE"), "3d");
    expect(models()).toHaveLength(1);
  });
});
