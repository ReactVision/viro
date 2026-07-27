/**
 * Subscribe to the device-global RECORD_VIDEO recording state. Hosts render their
 * own recording indicator with this, positioning it in their own layout / safe-
 * area insets (viro can't see host chrome, so it can't place an overlay relative
 * to it). `startedAt` is epoch ms, or null when idle.
 */
export declare function useStudioRecording(): {
    isRecording: boolean;
    startedAt: number | null;
};
