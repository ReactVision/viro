import * as React from "react";
import { ViewStyle } from "react-native";
import { StudioSceneResponse } from "./types";
/** Imperative handle exposed via ref. */
export interface StudioSceneNavigatorHandle {
    /** Screenshots the AR renderer. Resolves `{ success: false }` (no-op) on Quest. */
    takeScreenshot: (fileName: string, saveToCameraRoll: boolean) => Promise<{
        success: boolean;
        url?: string;
        errorCode?: string;
    }>;
}
interface StudioSceneNavigatorProps {
    /**
     * UUID of a specific scene to load. If omitted, the navigator fetches the
     * project configured in the app manifest and uses its opening scene.
     */
    sceneId?: string;
    worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
    autofocus?: boolean;
    style?: ViewStyle;
    onSceneReady?: () => void;
    onError?: (err: Error) => void;
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    onExitViro?: () => void;
    /** Fired after the scene is fetched and parsed, before it is pushed. */
    onSceneLoaded?: (sceneData: StudioSceneResponse) => void;
    /** Threaded to the initial scene's StudioARScene (initial scene only). */
    onPlaneDetected?: () => void;
    onPlaneSelected?: () => void;
    noAssetsMessage?: string;
}
/**
 * Cross-reality Studio scene navigator. Renders a Studio-authored scene on
 * both AR devices (iOS / non-Quest Android) and Meta Quest (VR).
 *
 * Opening-scene resolution order:
 *   1. `sceneId` prop → use it directly
 *   2. Native project (RVProjectId from manifest) → use `opening_scene.id`
 *   3. Fallback → first scene in the project's scene list
 *
 * On Quest, ViroXRSceneNavigator is not rendered until the scene data is
 * ready. This means VRActivity always launches with the actual content scene
 * as its initial scene, avoiding the LoadingVRScene → replace timing race.
 */
export declare const StudioSceneNavigator: React.ForwardRefExoticComponent<StudioSceneNavigatorProps & React.RefAttributes<StudioSceneNavigatorHandle>>;
export {};
