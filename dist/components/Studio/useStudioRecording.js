"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioRecording = useStudioRecording;
const react_1 = require("react");
const recordingStore_1 = require("./domain/recordingStore");
const subscribe = (onChange) => recordingStore_1.studioRecordingStore.subscribe(onChange);
/**
 * Subscribe to the device-global RECORD_VIDEO recording state. Hosts render their
 * own recording indicator with this, positioning it in their own layout / safe-
 * area insets (viro can't see host chrome, so it can't place an overlay relative
 * to it). `startedAt` is epoch ms, or null when idle.
 */
function useStudioRecording() {
    // Server snapshot: see the note in useStudioPlacement. Nothing is recording
    // on a server, and saying so is better than throwing.
    const isRecording = (0, react_1.useSyncExternalStore)(subscribe, () => recordingStore_1.studioRecordingStore.isRecording(), () => false);
    const startedAt = (0, react_1.useSyncExternalStore)(subscribe, () => recordingStore_1.studioRecordingStore.startedAt(), () => null);
    return { isRecording, startedAt };
}
