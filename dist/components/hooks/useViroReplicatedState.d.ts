/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroReplicatedState
 */
import { type ViroReplicatedEntity, type ViroReplicationConfig, type ViroReplicationRejection, type ViroReplicationState, type ViroWriteOptions } from "../AR/ViroReplication";
export type UseViroReplicatedStateOptions = ViroReplicationConfig & {
    /** Set false to stay disconnected — typically until the frame is established. */
    enabled?: boolean;
    /** Called for every refused operation, with the server's current value. */
    onReject?: (rejection: ViroReplicationRejection) => void;
};
export type UseViroReplicatedStateResult = {
    state: ViroReplicationState;
    /** This device's server-assigned id. Empty until connected. */
    localPeerId: string;
    entities: ViroReplicatedEntity[];
    byId: (id: string) => ViroReplicatedEntity | undefined;
    error?: string;
    /** Take authority over an entity, creating it if needed. */
    claim: (id: string, opts?: ViroWriteOptions) => void;
    release: (id: string) => void;
    /** Merge fields. Only the owner may write to an owned entity. */
    set: (id: string, fields: Record<string, unknown>, opts?: ViroWriteOptions) => void;
    remove: (id: string, opts?: ViroWriteOptions) => void;
    /** True when this device holds authority over `id`. */
    isMine: (id: string) => boolean;
};
/**
 * Replicated room state, ordered and conflict-resolved by the server.
 *
 * ```tsx
 * const { entities, claim, set, isMine } = useViroReplicatedState({
 *   roomId: cloudAnchorId, apiKey, projectId,
 *   enabled: frameReady,
 * });
 *
 * // Grab it, then move it — while held, nobody else can.
 * claim('cube');
 * if (isMine('cube')) set('cube', { position: [0, 0, -1] }, { optimistic: true });
 * ```
 *
 * Positions stored here are **location-frame** coordinates, same as the
 * channel: world coordinates are per-session and mean nothing to a peer.
 */
export declare function useViroReplicatedState(options: UseViroReplicatedStateOptions): UseViroReplicatedStateResult;
