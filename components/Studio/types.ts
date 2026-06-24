// Types mirror the actual server response from GET /functions/v1/scenes/{scene_id}.
// Field names are snake_case as returned by the Supabase Edge Function / Postgres RPC.

export interface StudioSceneCreatedBy {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface StudioSceneMeta {
  id: string;
  name: string | null;
  belongs_to_project: string;
  plane_detection: string | null; // 'AUTOMATIC' | 'MANUAL' | 'NONE'
  plane_direction: string | null; // 'Horizontal' | 'Vertical'
  on_load_function: string | null;
  physics_world_config: Record<string, unknown> | null;
  created_at: string;
  created_by: StudioSceneCreatedBy | null;
}

export interface StudioProjectMeta {
  id: string;
  occlusion_mode: "NONE" | "PEOPLEONLY" | "DEPTHBASED";
}

/**
 * One ordered step of a Sequence: an ACTION (runs a function), a WAIT (timed
 * pause), or a STOP (explicit terminal — the run halts here).
 */
export interface StudioSequenceStep {
  id: string;
  step_order: number;
  step_type: "ACTION" | "WAIT" | "STOP";
  duration_ms: number | null; // set for WAIT
  function_id: string | null; // set for ACTION
  function: StudioSceneFunction | null; // resolved child for ACTION; null for WAIT/STOP
  // false (default) = wait for this step's effect to finish before the next
  // step; true = fire-and-forget. Ignored for instant/terminal kinds.
  advance_immediately: boolean;
}

export interface StudioSequence {
  id: string;
  name: string | null;
  steps: StudioSequenceStep[];
}

/** Scene-level variable declaration. Runtime state lives in StudioVariableStore. */
export interface StudioSceneVariable {
  id: string;
  name: string;
  type: "BOOLEAN" | "NUMBER" | "STRING";
  initial_value: boolean | number | string;
}

/**
 * One ordered predicate arm of a BRANCH. Variable names/types are joined from
 * project_variables so they follow renames. The arm is an owned, headless
 * sequence run like a nested sequence.
 */
export interface StudioBranchCondition {
  id: string;
  eval_order: number;
  variable_id: string;
  variable_name: string;
  variable_type: "BOOLEAN" | "NUMBER" | "STRING";
  comparison:
    | "EQUALS"
    | "NOT_EQUALS"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "GREATER_OR_EQUAL"
    | "LESS_OR_EQUAL"
    | "LIKE"
    | "ILIKE";
  compare_literal: boolean | number | string | null;
  compare_variable_id: string | null;
  compare_variable_name: string | null;
  compare_variable_type: "BOOLEAN" | "NUMBER" | "STRING" | null;
  sequence: StudioSequence;
}

/**
 * BRANCH payload. Conditions are evaluated in eval_order (first match wins),
 * falling through to the optional no-match arm. Arms are owned, headless
 * sequences run like nested sequences.
 */
export interface StudioSceneBranch {
  id: string;
  conditions: StudioBranchCondition[];
  no_match_sequence: StudioSequence | null;
}

/**
 * GROUP payload. Owns N lanes, each an owned headless sequence run like a
 * nested sequence. Lanes run concurrently; the group completes when all lanes
 * complete (barrier join).
 */
export interface StudioSceneGroup {
  id: string;
  lanes: { lane_order: number; sequence: StudioSequence }[];
}

/** One response->variable binding of an API_REQUEST function. */
export interface StudioApiRequestBinding {
  id: string;
  source: "BODY" | "STATUS" | "OK" | "ERROR_MESSAGE";
  selector: string | null;
  variable_id: string;
  variable_name: string;
  variable_type: "BOOLEAN" | "NUMBER" | "STRING";
  bind_order: number;
}

/**
 * API_REQUEST payload. The HTTP call executes server-side through the
 * platform egress proxy (the client only ever sends the function id plus
 * current variable values); connection_id is an opaque server-side
 * reference. Arms are owned, headless sequences run like nested sequences.
 */
export interface StudioSceneApiRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url_template: string;
  headers: { key: string; value_template: string }[];
  body_template: string | null;
  timeout_ms: number;
  connection_id: string | null;
  bindings: StudioApiRequestBinding[];
  success_sequence: StudioSequence | null;
  failure_sequence: StudioSequence | null;
}

/** Outcome envelope an API-request executor resolves with. */
export interface StudioApiRequestOutcome {
  ok: boolean;
  status: number | null;
  body?: unknown;
  error_code?: string | null;
  error_message?: string | null;
}

/**
 * Host-app transport for API_REQUEST functions: StudioGo calls the
 * scene-api-request edge function with the user JWT; production Viro apps
 * call it with their X-API-Key. Must resolve with an outcome (reject only on
 * transport failure).
 */
export type StudioApiRequestExecutor = (
  functionId: string,
  variables: Record<string, boolean | number | string>,
) => Promise<StudioApiRequestOutcome>;

export interface StudioSceneFunction {
  id: string;
  scene: string;
  function_type:
    | "NAVIGATION"
    | "ALERT"
    | "ANIMATION"
    | "SEQUENCE"
    | "SET_VARIABLE"
    | "BRANCH"
    | "API_REQUEST"
    | "SET_VISIBILITY"
    | "SOUND"
    | "GROUP";
  navigation: string | null;
  alert: string | null;
  animation: string | null;
  sequence: string | null;
  set_variable: string | null;
  branch: string | null;
  api_request: string | null;
  set_visibility: string | null;
  sound: string | null;
  // Named group_fn because `group` is a reserved SQL keyword.
  group_fn: string | null;
  scene_navigation: { id: string; navigate_to: string } | null;
  scene_alert: {
    id: string;
    alert_title: string | null;
    alert_message: string | null;
  } | null;
  scene_animation: {
    id: string;
    animation_key: string;
    duration_ms: number | null;
    delay_ms: number | null;
    properties: Record<string, unknown>;
  } | null;
  scene_sequence: StudioSequence | null;
  /** name/type are joined from the target scene_variables row, so they follow renames. */
  scene_set_variable: {
    id: string;
    variable_id: string;
    name: string;
    type: "BOOLEAN" | "NUMBER" | "STRING";
    expression: string;
  } | null;
  scene_branch: StudioSceneBranch | null;
  scene_api_request: StudioSceneApiRequest | null;
  scene_set_visibility: {
    id: string;
    target_asset_id: string;
    state: "VISIBLE" | "HIDDEN" | "TOGGLE";
  } | null;
  scene_sound: {
    id: string;
    action: "PLAY" | "STOP";
    audio_asset_id: string | null;
    audio_url: string | null;
    target_asset_id: string | null;
    volume: number;
    loop: boolean;
    stop_other_sounds: boolean;
  } | null;
  scene_group: StudioSceneGroup | null;
}

export interface StudioAsset {
  id: string; // scene asset placement ID
  name: string | null;
  description: string | null;
  file_url: string | null;
  file_size: number | null;
  asset_type_name: "3D-MODEL" | "TEXT" | "IMAGE" | "VIDEO" | null;
  position_x: number | null;
  position_y: number | null;
  position_z: number | null;
  rotation_x: number | null; // radians
  rotation_y: number | null;
  rotation_z: number | null;
  scale: number | null;
  latitude: number | null;
  longitude: number | null;
  is_draggable: boolean;
  /** Author-time "hidden on start"; the runtime seeds visibility from it. */
  hidden_on_load: boolean | null;
  trigger_image_url: string | null;
  trigger_image_orientation: "Up" | "Down" | "Left" | "Right" | null;
  trigger_image_physical_width_m: number | null;
  material_config: Record<string, unknown> | null;
  physics_config: Record<string, unknown> | null;
  on_click_function: string | null; // UUID → look up in functions[]
  asset_id: string | null; // team asset type UUID
  created_at: string;
  updated_at: string;
  scene_function: StudioSceneFunction | null; // resolved on_click_function inline
}

export interface StudioCollisionBinding {
  id: string;
  scene_id: string;
  function_id: string;
  asset_x_id: string;
  asset_y_id: string;
  scene_function: StudioSceneFunction;
}

export interface StudioAnimation {
  id: string;
  scene_id: string;
  target_asset_id: string;
  animation_key: string; // ViroAnimations registry key
  properties: Record<string, unknown>; // Viro keyframe format
  duration_ms: number | null;
  delay_ms: number | null;
  easing:
    | "Linear"
    | "EaseIn"
    | "EaseOut"
    | "EaseInEaseOut"
    | "Bounce"
    | null;
  loop: boolean;
  interruptible: boolean;
  on_start_function: string | null;
  on_finish_function: string | null;
}

export interface StudioProjectAsset {
  id: string;
  name: string | null;
  url: string | null;
}

export interface StudioProjectSceneSummary {
  id: string;
  name: string | null;
  created_at: string;
  created_by: StudioSceneCreatedBy | null;
  assets: StudioProjectAsset[];
}

export interface StudioProjectOpeningScene {
  id: string;
  name: string | null;
}

export interface StudioProjectOverview {
  id: string;
  name: string;
  thumbnail: string | null;
  occlusion_mode: "NONE" | "PEOPLEONLY" | "DEPTHBASED";
  created_at: string;
  created_by: StudioSceneCreatedBy | null;
  opening_scene: StudioProjectOpeningScene | null;
  scenes: StudioProjectSceneSummary[];
}

/** Top-level response from GET /functions/v1/projects/{project_id} (after JSON.parse) */
export interface StudioProjectApiResponse {
  project: StudioProjectOverview;
  meta: { request_id: string };
}

/** Top-level response from GET /functions/v1/scenes/{scene_id} (after JSON.parse) */
export interface StudioSceneResponse {
  scene: StudioSceneMeta;
  project: StudioProjectMeta;
  assets: StudioAsset[];
  collision_bindings: StudioCollisionBinding[];
  animations: StudioAnimation[];
  functions: StudioSceneFunction[];
  /** Absent in responses from backends predating the Variables feature. */
  variables?: StudioSceneVariable[];
  meta: { request_id: string };
}

/** Viro animation prop shape passed to Viro components */
export type ViroAnimationProp = {
  name: string;
  run: boolean;
  loop: boolean;
  interruptible: boolean;
  delay: number;
  onStart?: () => void;
  onFinish?: () => void;
};
