import { useSyncExternalStore } from "react";
import { studioRecordingStore } from "./domain/recordingStore";

const subscribe = (onChange: () => void) =>
  studioRecordingStore.subscribe(onChange);

/**
 * Subscribe to the device-global RECORD_VIDEO recording state. Hosts render their
 * own recording indicator with this, positioning it in their own layout / safe-
 * area insets (viro can't see host chrome, so it can't place an overlay relative
 * to it). `startedAt` is epoch ms, or null when idle.
 */
export function useStudioRecording(): {
  isRecording: boolean;
  startedAt: number | null;
} {
  // Server snapshot: see the note in useStudioPlacement. Nothing is recording
  // on a server, and saying so is better than throwing.
  const isRecording = useSyncExternalStore(
    subscribe,
    () => studioRecordingStore.isRecording(),
    () => false
  );
  const startedAt = useSyncExternalStore(
    subscribe,
    () => studioRecordingStore.startedAt(),
    () => null
  );
  return { isRecording, startedAt };
}
