"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studioRecordingStore = void 0;
const utils_1 = require("./utils");
/**
 * Screen recording is device-global (one session per process) and the native
 * recorder exposes no isRecording query, so this module singleton is the single
 * source of truth. The RECORD_VIDEO dispatch arm flips it (start on the first
 * trigger, stop on the next) and the on-screen REC indicator subscribes to it.
 */
class StudioRecordingStore {
    recording = false;
    startedAtMs = null;
    listeners = new utils_1.GlobalListeners();
    isRecording() {
        return this.recording;
    }
    /** Epoch ms when the current recording began, or null when idle. */
    startedAt() {
        return this.startedAtMs;
    }
    /** Subscribe to start/stop changes; returns an unsubscribe fn. */
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    start() {
        if (this.recording)
            return;
        this.recording = true;
        this.startedAtMs = Date.now();
        this.listeners.notify();
    }
    stop() {
        if (!this.recording)
            return;
        this.recording = false;
        this.startedAtMs = null;
        this.listeners.notify();
    }
    /** Force idle on unmount so a recording torn down mid-flight can't wedge the
     * flag (and the indicator) on for the next session. */
    reset() {
        if (!this.recording && this.startedAtMs === null)
            return;
        this.recording = false;
        this.startedAtMs = null;
        this.listeners.notify();
    }
}
exports.studioRecordingStore = new StudioRecordingStore();
