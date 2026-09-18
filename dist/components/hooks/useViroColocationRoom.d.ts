/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroColocationRoom
 */
import { type ViroFrameSource } from "../AR/ViroFrameSource";
import { type ViroColocationRoom, type ViroColocationRoomsConfig, type ViroRoomFrame } from "../AR/ViroColocationRooms";
export type UseViroColocationRoomOptions = ViroColocationRoomsConfig & {
    /**
     * Create a room for a frame this device has established. The host path.
     * Mutually exclusive with `joinCode`.
     */
    host?: ViroRoomFrame & {
        name?: string;
    };
    /** Join a room someone read out. The guest path. */
    joinCode?: string;
    /** Set false to hold off, for instance until an anchor has finished hosting. */
    enabled?: boolean;
};
export type UseViroColocationRoomResult = {
    status: "idle" | "working" | "ready" | "failed";
    room: ViroColocationRoom | null;
    /** Pass to `useViroColocation` and `ViroReplicationClient`. */
    roomId: string | null;
    /** The code grouped for display, as `K7M 2QX`. Null until there is one. */
    displayCode: string | null;
    /**
     * The frame source this room's devices align with, ready for
     * `ViroSharedFrame`. Null until the room is known.
     */
    frameSource: ViroFrameSource | null;
    error?: string;
    /** Try again after a failure. */
    retry: () => void;
};
/**
 * Turn a frame into a room others can join, or a code into the room and the
 * frame source that goes with it.
 *
 * ```tsx
 * // The device that scanned the space
 * const host = useViroColocationRoom({ apiKey, projectId,
 *   host: { frameKind: "cloud_anchor", cloudAnchorId } });
 * // <Text>{host.displayCode}</Text>
 *
 * // Everyone else
 * const guest = useViroColocationRoom({ apiKey, projectId, joinCode: typed });
 * // <ViroSharedFrame source={guest.frameSource} ... />
 * ```
 *
 * One request, before the session starts. The frame acquisition that follows it
 * takes 12 to 30 seconds on phones, so this is not the slow part.
 */
export declare function useViroColocationRoom(options: UseViroColocationRoomOptions): UseViroColocationRoomResult;
