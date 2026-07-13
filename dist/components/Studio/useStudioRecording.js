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
    const isRecording = (0, react_1.useSyncExternalStore)(subscribe, () => recordingStore_1.studioRecordingStore.isRecording());
    const startedAt = (0, react_1.useSyncExternalStore)(subscribe, () => recordingStore_1.studioRecordingStore.startedAt());
    return { isRecording, startedAt };
}
