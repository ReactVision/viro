import type { StudioColocationOriginPrompt } from "../colocation/indicatorContent";
import type { StudioColocationState } from "../colocation/types";
/** Who writes to the store: each navigator passes a token of its own. */
export type StudioColocationStoreOwner = object;
/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 *
 * More than one navigator can be mounted (a screen pushed over another), so
 * each writes with its own owner token. The first to report a session owns the
 * store until it reports idle again or unmounts; meanwhile the others' writes
 * and resets are ignored, so unmounting one navigator never clears another's
 * live session.
 */
declare class StudioColocationStore {
    private state;
    private originPrompt;
    private owner;
    private finishScanHandlers;
    private builtInIndicator;
    private listeners;
    getState(): StudioColocationState;
    subscribe(listener: () => void): () => void;
    /** Ignored while another owner's session is reported. */
    set(state: StudioColocationState, owner?: StudioColocationStoreOwner): void;
    getOriginPrompt(): StudioColocationOriginPrompt | null;
    setOriginPrompt(prompt: StudioColocationOriginPrompt | null, owner?: StudioColocationStoreOwner): void;
    /** The owning navigator's `colocationIndicator`, which the Quest HUD honours too. */
    isBuiltInIndicatorShown(): boolean;
    setBuiltInIndicatorShown(shown: boolean, owner?: StudioColocationStoreOwner): void;
    setFinishScanHandler(handler: (() => boolean) | null, owner?: StudioColocationStoreOwner): void;
    /** The owning session's scan. False when none is scanning or it cannot finish yet. */
    finishScan(): boolean;
    /**
     * A navigator unmounting: forgets its handler and indicator setting, and
     * forces idle when it owns the store (or nothing does), so a torn-down
     * session cannot leave the indicator showing. With no owner, resets all.
     */
    reset(owner?: StudioColocationStoreOwner): void;
    private writable;
}
export declare const studioColocationStore: StudioColocationStore;
export {};
