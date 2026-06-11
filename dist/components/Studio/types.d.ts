export interface StudioSceneCreatedBy {
    id: string;
    first_name: string | null;
    last_name: string | null;
}
export interface StudioSceneMeta {
    id: string;
    name: string | null;
    belongs_to_project: string;
    plane_detection: string | null;
    plane_direction: string | null;
    on_load_function: string | null;
    physics_world_config: Record<string, unknown> | null;
    created_at: string;
    created_by: StudioSceneCreatedBy | null;
}
export interface StudioProjectMeta {
    id: string;
    occlusion_mode: "NONE" | "PEOPLEONLY" | "DEPTHBASED";
}
/** One ordered step of a Sequence: an ACTION (runs a function) or a WAIT (timed pause). */
export interface StudioSequenceStep {
    id: string;
    step_order: number;
    step_type: "ACTION" | "WAIT";
    duration_ms: number | null;
    function_id: string | null;
    function: StudioSceneFunction | null;
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
 * BRANCH payload. Variable names/types are joined from scene_variables so they
 * follow renames. Arms are owned, headless sequences run like nested sequences.
 */
export interface StudioSceneBranch {
    id: string;
    variable_id: string;
    variable_name: string;
    variable_type: "BOOLEAN" | "NUMBER" | "STRING";
    comparison: "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "GREATER_OR_EQUAL" | "LESS_OR_EQUAL" | "LIKE" | "ILIKE";
    compare_literal: boolean | number | string | null;
    compare_variable_id: string | null;
    compare_variable_name: string | null;
    compare_variable_type: "BOOLEAN" | "NUMBER" | "STRING" | null;
    then_sequence: StudioSequence;
    else_sequence: StudioSequence | null;
}
export interface StudioSceneFunction {
    id: string;
    scene: string;
    function_type: "NAVIGATION" | "ALERT" | "ANIMATION" | "SEQUENCE" | "SET_VARIABLE" | "BRANCH";
    navigation: string | null;
    alert: string | null;
    animation: string | null;
    sequence: string | null;
    set_variable: string | null;
    branch: string | null;
    scene_navigation: {
        id: string;
        navigate_to: string;
    } | null;
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
}
export interface StudioAsset {
    id: string;
    name: string | null;
    description: string | null;
    file_url: string | null;
    file_size: number | null;
    asset_type_name: "3D-MODEL" | "TEXT" | "IMAGE" | "VIDEO" | null;
    position_x: number | null;
    position_y: number | null;
    position_z: number | null;
    rotation_x: number | null;
    rotation_y: number | null;
    rotation_z: number | null;
    scale: number | null;
    latitude: number | null;
    longitude: number | null;
    is_draggable: boolean;
    trigger_image_url: string | null;
    trigger_image_orientation: "Up" | "Down" | "Left" | "Right" | null;
    trigger_image_physical_width_m: number | null;
    material_config: Record<string, unknown> | null;
    physics_config: Record<string, unknown> | null;
    on_click_function: string | null;
    asset_id: string | null;
    created_at: string;
    updated_at: string;
    scene_function: StudioSceneFunction | null;
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
    animation_key: string;
    properties: Record<string, unknown>;
    duration_ms: number | null;
    delay_ms: number | null;
    easing: "Linear" | "EaseIn" | "EaseOut" | "EaseInEaseOut" | "Bounce" | null;
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
    meta: {
        request_id: string;
    };
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
    meta: {
        request_id: string;
    };
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
