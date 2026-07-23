import * as React from "react";
import { StudioVariableStore } from "./domain/variableStore";
import { StudioPlacementStore } from "./domain/placementStore";
import { StudioSceneResponse } from "./types";
/** Imperative placement surface the navigator's tap overlay drives (mobile AR). */
export type StudioPlacementApi = {
    placeAtScreenPoint: (x: number, y: number) => Promise<"placed" | "miss">;
};
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
    /** Placement store owned by the navigator so its tap overlay can read active state. */
    placementStore?: StudioPlacementStore;
    /** The navigator's tap overlay writes the placement API here (mobile AR). */
    placementApiRef?: React.MutableRefObject<StudioPlacementApi | null>;
}
/**
 * Outer gate: keeps the hooks-bearing inner component out of the tree until
 * sceneData is available, avoiding a Rules of Hooks violation.
 */
export declare const StudioARScene: React.FC<StudioARSceneProps>;
export {};
