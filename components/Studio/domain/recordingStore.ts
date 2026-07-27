import { GlobalListeners } from "./utils";

/**
 * Screen recording is device-global (one session per process) and the native
 * recorder exposes no isRecording query, so this module singleton is the single
 * source of truth. The RECORD_VIDEO dispatch arm flips it (start on the first
 * trigger, stop on the next) and the on-screen REC indicator subscribes to it.
 */
class StudioRecordingStore {
  private recording = false;
  private startedAtMs: number | null = null;
  private listeners = new GlobalListeners();

  isRecording(): boolean {
    return this.recording;
  }

  /** Epoch ms when the current recording began, or null when idle. */
  startedAt(): number | null {
    return this.startedAtMs;
  }

  /** Subscribe to start/stop changes; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  start(): void {
    if (this.recording) return;
    this.recording = true;
    this.startedAtMs = Date.now();
    this.listeners.notify();
  }

  stop(): void {
    if (!this.recording) return;
    this.recording = false;
    this.startedAtMs = null;
    this.listeners.notify();
  }

  /** Force idle on unmount so a recording torn down mid-flight can't wedge the
   * flag (and the indicator) on for the next session. */
  reset(): void {
    if (!this.recording && this.startedAtMs === null) return;
    this.recording = false;
    this.startedAtMs = null;
    this.listeners.notify();
  }
}

export const studioRecordingStore = new StudioRecordingStore();
