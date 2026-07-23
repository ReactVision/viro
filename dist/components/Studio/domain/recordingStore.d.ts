/**
 * Screen recording is device-global (one session per process) and the native
 * recorder exposes no isRecording query, so this module singleton is the single
 * source of truth. The RECORD_VIDEO dispatch arm flips it (start on the first
 * trigger, stop on the next) and the on-screen REC indicator subscribes to it.
 */
declare class StudioRecordingStore {
    private recording;
    private startedAtMs;
    private listeners;
    isRecording(): boolean;
    /** Epoch ms when the current recording began, or null when idle. */
    startedAt(): number | null;
    /** Subscribe to start/stop changes; returns an unsubscribe fn. */
    subscribe(listener: () => void): () => void;
    start(): void;
    stop(): void;
    /** Force idle on unmount so a recording torn down mid-flight can't wedge the
     * flag (and the indicator) on for the next session. */
    reset(): void;
}
export declare const studioRecordingStore: StudioRecordingStore;
export {};
