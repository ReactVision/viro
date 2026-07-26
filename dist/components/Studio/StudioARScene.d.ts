import * as React from "react";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioSceneResponse } from "./types";
interface StudioARSceneProps {
    sceneNavigator?: any;
    sceneData: StudioSceneResponse | null;
    onReady?: () => void;
    onError?: (err: Error) => void;
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    /** Fired on first AR plane detection (AUTOMATIC) / plane accept (MANUAL). */
    onPlaneDetected?: () => void;
    /** Fired when the user taps to select a plane (MANUAL mode). */
    onPlaneSelected?: () => void;
    /** Text shown when the scene has no assets. Defaults to "No assets to display". */
    noAssetsMessage?: string;
    /** Session-scoped store owned by the navigator; survives scene pushes. */
    variableStore?: StudioVariableStore;
}
/**
 * Outer gate: keeps the hooks-bearing inner component out of the tree until
 * sceneData is available, avoiding a Rules of Hooks violation.
 */
export declare const StudioARScene: React.FC<StudioARSceneProps>;
export {};
