import { StudioAnimation, StudioApiRequestExecutor, StudioSceneFunction } from "../types";
import { StudioSoundManager } from "./soundManager";
import { StudioVariableStore } from "./variableStore";
import { StudioVisibilityStore } from "./visibilityStore";
type SceneNavigator = any;
export declare class SequenceScheduler {
    private timers;
    private appStateSub;
    private backgrounded;
    private activeSequences;
    private generationCounter;
    get generation(): number;
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
 * Runtime context threaded through executeFunctionWithRelations: the Sequence
 * scheduler plus the per-session variable store and API-request transport
 * (optional so dispatch sites without them keep working).
 */
export type SequenceRuntimeContext = {
    scheduler: SequenceScheduler;
    variableStore?: StudioVariableStore;
    apiRequestExecutor?: StudioApiRequestExecutor;
    visibilityStore?: StudioVisibilityStore;
    soundManager?: StudioSoundManager;
    getAssetPosition?: (assetId: string) => [number, number, number] | undefined;
};
/** Used by onClick, onCollision, and on_load_function triggers. */
export declare function executeFunctionWithRelations(fn: StudioSceneFunction, sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, depth?: number, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): void;
export declare function executeOnLoadFunction(functionId: string, functions: StudioSceneFunction[], sceneNavigator: SceneNavigator | undefined, animations: StudioAnimation[], onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, onSceneChange?: (sceneId: string, sceneName: string) => void, runtimeCtx?: SequenceRuntimeContext): void;
export {};
