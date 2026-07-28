/**
 * Minimal Studio scene fixture for the web-host harness. Mirrors the server
 * response shape (StudioSceneResponse) so StudioSceneNavigator.web can render it
 * without a backend. plane_detection = NONE → the navigator picks 3D mode (no
 * camera/slam needed for a smoke test).
 */
import type { StudioAsset, StudioSceneResponse } from "../components/Studio/types";

const now = "2026-01-01T00:00:00.000Z";

function asset(partial: Partial<StudioAsset> & Pick<StudioAsset, "id" | "asset_type_name">): StudioAsset {
  return {
    name: null,
    description: null,
    file_url: null,
    file_size: null,
    position_x: 0,
    position_y: 0,
    position_z: -2,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    scale: 1,
    latitude: null,
    longitude: null,
    is_draggable: false,
    hidden_on_load: false,
    trigger_image_url: null,
    trigger_image_orientation: null,
    trigger_image_physical_width_m: null,
    material_config: null,
    physics_config: null,
    on_click_function: null,
    asset_id: null,
    created_at: now,
    updated_at: now,
    scene_function: null,
    ...partial,
  };
}

export function makeStudioScene(opts: { modelUrl: string; imageUrl: string }): StudioSceneResponse {
  return {
    scene: {
      id: "scene-fixture-1",
      name: "Fixture Scene",
      belongs_to_project: "project-fixture-1",
      plane_detection: "NONE",
      plane_direction: "Horizontal",
      on_load_function: null,
      physics_world_config: null,
      created_at: now,
      created_by: null,
    },
    project: { id: "project-fixture-1", occlusion_mode: "NONE" },
    assets: [
      asset({
        id: "a-text",
        asset_type_name: "TEXT",
        // The node factory renders asset.name as the text content.
        name: "Studio en web",
        position_x: 0,
        position_y: 1.4,
        position_z: -3,
      }),
      asset({
        id: "a-image",
        asset_type_name: "IMAGE",
        name: "Picture",
        file_url: opts.imageUrl,
        position_x: -1.6,
        position_y: 0,
        position_z: -3,
      }),
      asset({
        id: "a-model",
        asset_type_name: "3D-MODEL",
        name: "Helmet",
        file_url: opts.modelUrl,
        position_x: 1.4,
        position_y: 0,
        position_z: -3,
        scale: 0.8,
      }),
    ],
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    is_free_tier: true,
    meta: { request_id: "fixture" },
  };
}
