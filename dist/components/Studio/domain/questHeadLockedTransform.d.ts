import type { Viro3DPoint, ViroRotation } from "../../Types/ViroUtils";
export type CameraPose = {
    position: Viro3DPoint;
    forward: Viro3DPoint;
    /** Optional — only needed for a vertical offset (see verticalOffsetM). */
    up?: Viro3DPoint;
};
/**
 * World position + yaw-only rotation for a panel that should sit `distanceM`
 * in front of wherever the camera is currently looking, facing back toward
 * it. Pitch/roll are left at 0 so the panel always stays upright and legible
 * rather than tilting with head pitch — same yaw-only simplification already
 * used for anchor rotation elsewhere in this codebase (VPS-Lite's
 * computeLocationTransform), not a full look-at quaternion.
 *
 * Quest has no 2D overlay surface — this is the only way to keep in-scene VR
 * UI (alerts, exit/scene-name/plane-status HUD) readable regardless of where
 * the user is looking.
 *
 * NOT verified on real hardware: assumes a 2D plane (ViroFlexView/ViroText)
 * faces +Z by default, same as the camera's own forward convention, which is
 * why the panel is rotated 180° from the camera's yaw so its front faces the
 * user instead of matching the camera's own facing. If the panel renders
 * backwards (invisible / mirrored text) on device, drop the `+ 180`.
 */
export declare function computeHeadLockedTransform(pose: CameraPose, opts?: {
    distanceM?: number;
    verticalOffsetM?: number;
}): {
    position: Viro3DPoint;
    rotation: ViroRotation;
};
