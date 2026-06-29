import * as React from "react";
import { ViewProps } from "react-native";
type SceneFactory = {
    scene: () => React.JSX.Element;
};
/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator` (rendered inline)
 *  - **Meta Quest** → launches VRActivity via `VRLauncher.launchVRScene()` and
 *    forwards all navigator operations (push/pop/etc.) to the
 *    `ViroVRSceneNavigator` running there via `VRQuestNavigatorBridge`.
 *    Render output is null — VRActivity owns the display.
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 *
 * Renderer flags (`hdrEnabled`, `pbrEnabled`, `bloomEnabled`, `shadowsEnabled`,
 * `passthroughEnabled`, etc.) are forwarded to ViroVRSceneNavigator on Quest
 * via the intent bridge.
 */
export declare const ViroXRSceneNavigator: React.ForwardRefExoticComponent<ViewProps & {
    /**
     * Scene used on both AR and VR platforms when no platform-specific scene is provided.
     * Most apps want a different scene per platform — pass `arInitialScene` and
     * `vrInitialScene` instead in that case.
     */
    initialScene?: SceneFactory;
    /** Scene mounted on iOS / non-Quest Android (rendered via ViroARSceneNavigator). */
    arInitialScene?: SceneFactory;
    /**
     * Scene mounted on Meta Quest (rendered via ViroVRSceneNavigator in VRActivity).
     * On Quest, this scene is forwarded to VRActivity via VRQuestNavigatorBridge
     * rather than rendered inline, because OpenXR exclusive display requires the
     * VR intent category on the host Activity.
     *
     * The scene root may be either:
     *  - `ViroScene`   → fully-virtual VR.
     *  - `ViroARScene` → mixed reality: passthrough is enabled automatically and
     *    real-time plane detection (XR_EXT_plane_detection, Quest 3 / 3S) drives
     *    `onAnchorFound` and `ViroARPlane`, exactly as on phone AR. A single
     *    AR-rooted `initialScene` therefore runs on phones (ARCore) and Quest (OpenXR)
     *    with no per-platform changes. See docs/QUEST_SETUP.md §7b.
     */
    vrInitialScene?: SceneFactory;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    autofocus?: boolean;
    videoQuality?: "High" | "Low";
    numberOfTrackedImages?: number;
    vrModeEnabled?: boolean;
    passthroughEnabled?: boolean;
    handTrackingEnabled?: boolean;
    onExitViro?: () => void;
    viroAppProps?: any;
    hdrEnabled?: boolean;
    pbrEnabled?: boolean;
    bloomEnabled?: boolean;
    shadowsEnabled?: boolean;
    multisamplingEnabled?: boolean;
    debug?: boolean;
} & React.RefAttributes<unknown>>;
export {};
