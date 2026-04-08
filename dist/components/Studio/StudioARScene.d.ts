import * as React from "react";
import { StudioSceneResponse } from "./types";
interface StudioARSceneProps {
    /** Injected automatically by ViroARSceneNavigator */
    sceneNavigator?: any;
    /** The fully loaded scene response — passed via passProps */
    sceneData: StudioSceneResponse | null;
    onReady?: () => void;
    onError?: (err: Error) => void;
    /** Called when a NAVIGATION function transitions to a new scene. */
    onSceneChange?: (sceneId: string, sceneName: string) => void;
}
/**
 * AR scene component driven by a StudioSceneResponse.
 * Passed as `scene` to ViroARSceneNavigator.initialScene and also
 * to sceneNavigator.push() when navigating between scenes.
 */
export declare const StudioARScene: React.FC<StudioARSceneProps>;
export {};
