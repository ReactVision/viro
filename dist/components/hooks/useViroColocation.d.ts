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
     * native module to JS. Swappable for events later without changing this
     * hook's API.
     *
     * Deliberately faster than the 20 Hz peers actually arrive at, because the
     * poll and the arrival are unsynchronised: polling at the arrival rate still
     * makes a pose wait half an interval on average for the next read, which is
     * latency on top of the network and shows up as a peer marker lagging the
     * person it marks. A read
     * that finds nothing new does not re-render, so the extra reads cost a native
     * call rather than a pass over every consumer.
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
