import * as React from "react";
import { CameraPose } from "./domain/questHeadLockedTransform";
type Props = {
    /** Latest cached camera pose (throttled — see StudioARScene). Null before
     * the first onCameraTransformUpdate fires. */
    cameraPose: CameraPose | null;
    sceneName: string | null;
    /** "AUTOMATIC" | "MANUAL" | "NONE" — plane status line is hidden for NONE. */
    planeDetectionMode: string;
    hasFoundPlane: boolean;
};
/**
 * Quest has no 2D chrome (header, back, plane banner) — StudioGo's is stuck
 * in MainActivity, out of view once VRActivity takes the display (see
 * ViroXRSceneNavigator, which renders null on Quest). This is the in-scene
 * replacement: a small persistent head-locked HUD with the scene name, plane
 * status, and an in-scene "Exit" the hardware back button already covers,
 * but this makes it discoverable and provides a scene name / plane status
 * that has no other Quest-visible equivalent.
 *
 * Sits below StudioQuestAlertOverlay's position (verticalOffsetM) so an
 * ALERT firing at the same time doesn't render on top of it.
 */
export declare function StudioQuestSceneHudOverlay({ cameraPose, sceneName, planeDetectionMode, hasFoundPlane, }: Props): React.JSX.Element | null;
export {};
