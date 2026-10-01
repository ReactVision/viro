import { type StudioEffectOrigin } from "./utils";
/**
 * Last-resort cap on how long a step waits for a non-looping PLAY to finish. A
 * clip that fails to load fires onError (released at once); a clip whose native
 * finish/error event is dropped or never arrives would otherwise stall the walk
 * forever, so the manager force-releases the waiter after this many ms.
 * Generous on purpose: it must outlast any realistic single clip so it never
 * cuts one short, only catches a genuine stall.
 */
export declare const SOUND_WAIT_BACKSTOP_MS: number;
/** One actively-playing sound, keyed in the manager by its monotonic playId. */
export type StudioSoundEntry = {
    playId: number;
    audioAssetId: string;
    url: string;
    position?: [number, number, number];
    volume: number;
    loop: boolean;
};
/** A PLAY or STOP as it reached the manager, which a shared session repeats elsewhere. */
export type StudioSoundCommand = {
    action: "play";
    audioAssetId: string;
    url: string;
    position?: [number, number, number];
    volume: number;
    loop: boolean;
    stopOthers: boolean;
} | {
    action: "stop";
    audioAssetId: string | null;
};
export type StudioSoundCommandListener = (command: StudioSoundCommand, origin: StudioEffectOrigin) => void;
/**
 * Per-scene sound store. PLAY adds an entry under a fresh playId; STOP removes
 * by audio asset id (null = all). The whole <StudioSounds> list re-renders on
 * any change, so subscribers are GLOBAL like StudioVariableStore (not per-key).
 */
export declare class StudioSoundManager {
    private sounds;
    private listeners;
    private nextPlayId;
    private finishCallbacks;
    private finishTimers;
    private commandListeners;
    /** Subscribe to any add/remove; returns an unsubscribe fn. */
    subscribe(listener: () => void): () => void;
    getActive(): StudioSoundEntry[];
    /** Each PLAY and STOP with its origin; a clip ending or a reset is not one. */
    subscribeCommands(listener: StudioSoundCommandListener): () => void;
    private command;
    /** Pull and invoke the stored completion callback (if any) for a playId. */
    private fire;
    /**
     * Adds a sound and returns its playId. onFinish (when given) resolves a step
     * waiting on a non-looping PLAY; it fires on natural finish or early stop.
     */
    play(entry: {
        audioAssetId: string;
        url: string;
        position?: [number, number, number];
        volume: number;
        loop: boolean;
        stopOthers: boolean;
    }, onFinish?: () => void, origin?: StudioEffectOrigin): number;
    /** null = stop all sounds; otherwise stop every entry for this audio asset. */
    stop(audioAssetId: string | null, origin?: StudioEffectOrigin): void;
    /** Drop one entry; onFinish calls this for non-looping sounds. */
    remove(playId: number): void;
    reset(): void;
}
