import * as React from "react";
import { ViewProps } from "react-native";
type SceneFactory = {
    scene: () => React.JSX.Element;
};
/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **Meta Quest** → `ViroVRSceneNavigator`
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator`
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
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
    /** Scene mounted on Meta Quest (rendered via ViroVRSceneNavigator). */
    vrInitialScene?: SceneFactory;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    autofocus?: boolean;
    videoQuality?: "High" | "Low";
    numberOfTrackedImages?: number;
    vrModeEnabled?: boolean;
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
