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
export interface StudioSceneFunction {
    id: string;
    scene: string;
    function_type: "NAVIGATION" | "ALERT" | "ANIMATION";
    navigation: string | null;
    alert: string | null;
    animation: string | null;
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
/** Top-level response from GET /functions/v1/scenes/{scene_id} (after JSON.parse) */
export interface StudioSceneResponse {
    scene: StudioSceneMeta;
    project: StudioProjectMeta;
    assets: StudioAsset[];
    collision_bindings: StudioCollisionBinding[];
    animations: StudioAnimation[];
    functions: StudioSceneFunction[];
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
