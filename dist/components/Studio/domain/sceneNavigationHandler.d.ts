import { StudioAnimation, StudioSceneFunction } from "../types";
type SceneNavigator = any;
export declare class SequenceScheduler {
    private timers;
    private appStateSub;
    private backgrounded;
    private activeSequences;
    constructor();
    beginSequence(id: string): boolean;
    endSequence(id: string): void;
    schedule(callback: () => void, ms: number): void;
    private arm;
    private pauseAll;
    private resumeAll;
    cancelAll(): void;
    dispose(): void;
}
/**
 * Runtime context threaded through executeFunctionWithRelations. Today it only
 * carries the Sequence scheduler; the Variables epic adds a variable store here
 * without a breaking signature change.
 */
export type SequenceRuntimeContext = {
    scheduler: SequenceScheduler;
};
/**
 * Single dispatcher for all scene function types.
 * Used by onClick, onCollision, and on_load_function triggers.
 */
export declare function executeFunctionWithRelations(fn: StudioSceneFunction, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, depth?: number, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): void;
/**
 * Executes the scene's on_load_function if set.
 */
export declare function executeOnLoadFunction(functionId: string, functions: StudioSceneFunction[], sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): void;
export {};
