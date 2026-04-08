import { StudioAnimation, StudioSceneFunction } from "../types";
type SceneNavigator = any;
/**
 * Single dispatcher for all scene function types.
 * Used by onClick, onCollision, and on_load_function triggers.
 */
export declare function executeFunctionWithRelations(fn: StudioSceneFunction, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, depth?: number, onSceneChange?: (sceneId: string, sceneName: string) => void): void;
/**
 * Executes the scene's on_load_function if set.
 */
export declare function executeOnLoadFunction(functionId: string, functions: StudioSceneFunction[], sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, onSceneChange?: (sceneId: string, sceneName: string) => void): void;
export {};
