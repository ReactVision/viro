/**
 * In AR the web host scales its light rig by the room's light estimate, under
 * the native host's rule.
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

import * as React from "react";
import { act } from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import { StudioARScene } from "../components/Studio/StudioARScene.web";
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

function render(data: StudioSceneResponse, props: Record<string, unknown> = {}) {
  act(() => {
    renderer = TestRenderer.create(<StudioARScene sceneData={data} mode="ar" {...props} />);
  });
}

const findType = (type: string) => renderer!.root.findAll((n) => n.type === type);

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  jest.restoreAllMocks();
});

describe("StudioARScene (web) and the room's light", () => {
  const intensities = () =>
    ["ViroAmbientLight", "ViroDirectionalLight"].map((t) => findType(t)[0].props.intensity);

  it("renders the rig as authored until an estimate arrives", () => {
    render(sceneData("NONE"));
    expect(intensities()).toEqual([300, 700]);
  });

  it("dims the whole rig in a dim room and never brightens it", () => {
    render(sceneData("NONE"));
    const [scene] = findType("ViroARScene");
    act(() => scene.props.onAmbientLightUpdate({ intensity: 500, color: "#ffffff" }));
    expect(intensities()).toEqual([150, 350]);
    act(() => scene.props.onAmbientLightUpdate({ intensity: 3000, color: "#ffffff" }));
    expect(intensities()).toEqual([300, 700]);
  });
});
