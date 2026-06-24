/** One actively-playing sound, keyed in the manager by its monotonic playId. */
export type StudioSoundEntry = {
    playId: number;
    audioAssetId: string;
    url: string;
    position?: [number, number, number];
    volume: number;
    loop: boolean;
};
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
    /** Subscribe to any add/remove; returns an unsubscribe fn. */
    subscribe(listener: () => void): () => void;
    private notify;
    getActive(): StudioSoundEntry[];
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
    }, onFinish?: () => void): number;
    /** null = stop all sounds; otherwise stop every entry for this audio asset. */
    stop(audioAssetId: string | null): void;
    /** Drop one entry; onFinish calls this for non-looping sounds. */
    remove(playId: number): void;
    reset(): void;
}
