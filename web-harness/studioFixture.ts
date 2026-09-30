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

export function makeStudioScene(opts: {
  modelUrl: string;
  imageUrl: string;
  /** PNG with transparent borders, placed in front of the model (W7). */
  alphaImageUrl?: string;
  /** A URL that 404s, so a 3D-MODEL asset fails and fires onAssetError. */
  missingModelUrl?: string;
  /** Extra GLB from ?glb=, rendered as its own asset. */
  extraModelUrl?: string;
}): StudioSceneResponse {
  const extra: StudioAsset[] = [];
  if (opts.alphaImageUrl) {
    extra.push(
      asset({
        id: "a-alpha-image",
        asset_type_name: "IMAGE",
        name: "Alpha borders",
        file_url: opts.alphaImageUrl,
        // Between the camera and the helmet, so the border has to show it.
        // Positions keep both on a portrait phone screen.
        position_x: 0.45,
        position_y: 0,
        position_z: -2,
        scale: 0.8,
      }),
    );
  }
  if (opts.missingModelUrl) {
    extra.push(
      asset({
        id: "a-missing-model",
        asset_type_name: "3D-MODEL",
        name: "Missing model (404)",
        file_url: opts.missingModelUrl,
        position_x: -0.9,
        position_y: -1.2,
        position_z: -3,
      }),
    );
  }
  if (opts.extraModelUrl) {
    extra.push(
      asset({
        id: "a-url-model",
        asset_type_name: "3D-MODEL",
        name: "?glb model",
        file_url: opts.extraModelUrl,
        position_x: 0,
        position_y: -0.6,
        position_z: -4,
      }),
    );
  }
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
        position_x: -0.9,
        position_y: 0,
        position_z: -3,
      }),
      asset({
        id: "a-model",
        asset_type_name: "3D-MODEL",
        name: "Helmet",
        file_url: opts.modelUrl,
        position_x: 0.7,
        position_y: 0,
        position_z: -3,
        scale: 0.8,
      }),
      ...extra,
    ],
    collision_bindings: [],
    animations: [],
    functions: [],
    variables: [],
    is_free_tier: true,
    meta: { request_id: "fixture" },
  };
}
