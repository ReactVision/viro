import type { StudioColocationOriginPrompt } from "../colocation/indicatorContent";
import type { StudioColocationState } from "../colocation/types";
/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 */
declare class StudioColocationStore {
    private state;
    private originPrompt;
    private finishScanHandler;
    private builtInIndicator;
    private listeners;
    getState(): StudioColocationState;
    subscribe(listener: () => void): () => void;
    set(state: StudioColocationState): void;
    getOriginPrompt(): StudioColocationOriginPrompt | null;
    setOriginPrompt(prompt: StudioColocationOriginPrompt | null): void;
    /** The navigator's `colocationIndicator`, which the Quest HUD honours too. */
    isBuiltInIndicatorShown(): boolean;
    setBuiltInIndicatorShown(shown: boolean): void;
    setFinishScanHandler(handler: (() => void) | null): void;
    finishScan(): void;
    /** Force idle so a torn-down session cannot leave the indicator showing. */
    reset(): void;
}
export declare const studioColocationStore: StudioColocationStore;
export {};
