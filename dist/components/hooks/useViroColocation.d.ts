/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroColocation
 */
import { type ViroColocationConfig, type ViroColocationPeer, type ViroColocationState } from "../AR/ViroColocation";
export type UseViroColocationResult = {
    /** False when the channel is unavailable on this build or platform. */
    available: boolean;
    state: ViroColocationState;
    /** This device's server-assigned id. Empty until joined. */
    localPeerId: string;
    peers: ViroColocationPeer[];
    error?: string;
    /** Publish the local pose, in the location frame, as a column-major CSV. */
    publishPose: (locationFramePoseCsv: string) => void;
};
export type UseViroColocationOptions = ViroColocationConfig & {
    /**
     * Set false to stay out of the room — useful while the frame is still being
     * established, since there is nothing meaningful to publish before then.
     */
    enabled?: boolean;
    /**
     * How often peers are read back, in ms. Peers arrive on a socket thread and
     * are polled rather than pushed: this codebase has no live event path from a
     * native module to JS, and 10 Hz of a small array is cheaper than building
     * one. Swappable for events later without changing this hook's API.
     */
    pollMs?: number;
};
/**
 * Join a co-location room and track its peers.
 *
 * ```tsx
 * const { peers, publishPose } = useViroColocation({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 * ```
 *
 * Poses on this channel are **location-frame** coordinates. Convert before
 * publishing and after receiving — see `ViroLocationFrame`.
 */
export declare function useViroColocation(options: UseViroColocationOptions): UseViroColocationResult;
