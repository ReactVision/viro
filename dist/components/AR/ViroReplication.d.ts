/**
 * Copyright © 2026 ReactVision
 *
 * Replicated room state — ordering, conflict resolution and authority.
 *
 * The co-location channel (`ViroColocation`) relays poses and is lossy by
 * design: the next pose supersedes the last one 100 ms later. Application state
 * does not work that way — "the door is open" has to survive a dropped frame, a
 * late joiner and a reconnect — so it gets a different transport with different
 * guarantees.
 *
 * ## Where this runs, and why it is not the channel
 *
 * A separate WebSocket, opened from JS, against the same room id. Poses
 * originate in C++ at frame rate and must not cross the bridge; application
 * state originates in JS and must not be lossy. One socket for both would make
 * each pay the other's cost.
 *
 * ## What the server guarantees
 *
 * Total order. Every accepted change carries a sequence number, identical for
 * every client. A gap means a delta was missed, and this client asks for a
 * resync rather than carrying on with a hole in its state.
 *
 * ## Conflict resolution
 *
 * - `claim()` takes authority over an entity. While held, only the owner may
 *   change it — that is how two people grabbing the same object resolve.
 * - `expectVersion` opts a write into optimistic concurrency: if the entity
 *   moved on, the write is refused and the current value comes back.
 * - Unowned entities are last-writer-wins.
 * - A peer that disconnects releases whatever it held, so a crash mid-drag does
 *   not freeze an object.
 *
 * @providesModule ViroReplication
 */
export type ViroReplicatedEntity = {
    id: string;
    fields: Record<string, unknown>;
    /** Server-assigned, bumped on every accepted change. Pass to `expectVersion`. */
    version: number;
    /** peerId holding authority, or null when free. */
    owner: string | null;
};
export type ViroReplicationState = "idle" | "connecting" | "synced" | "reconnecting" | "failed";
export type ViroReplicationRejectReason = "not-owner" | "version-conflict" | "already-owned" | "no-such-entity" | "malformed" | "too-many-entities" | "field-too-large"
/** The room is at the size its saved copy may be, so nothing more fits. */
 | "room-too-large"
/** Every room this team has open adds up to its ceiling on the relay. */
 | "org-too-large";
export type ViroReplicationRejection = {
    reason: ViroReplicationRejectReason;
    /** The entity's server state at the time of refusal, when it has one. */
    current?: ViroReplicatedEntity;
};
export type ViroReplicationConfig = {
    /** Same id that names the frame and the channel room. */
    roomId: string;
    apiKey: string;
    projectId: string;
    /**
     * Co-location relay base URL; `http(s)` is converted to `ws(s)`.
     *
     * The relay, not the platform API. `ViroColocationRooms` calls the platform
     * for join codes and they are different hosts, so one endpoint cannot serve
     * both.
     */
    endpoint?: string;
};
export type ViroWriteOptions = {
    /**
     * Refuse the write unless the entity is still at this version. Omit to accept
     * last-writer-wins.
     */
    expectVersion?: number;
    /**
     * Apply locally before the server confirms, and roll back if it refuses.
     *
     * Off by default: the simple path is one round trip and never shows a value
     * that turns out not to be true. Turn it on for something being dragged,
     * where a round trip per frame is visible.
     */
    optimistic?: boolean;
};
type Listener = () => void;
export declare class ViroReplicationClient {
    private ws;
    private config;
    private entities;
    private lastSeq;
    private _state;
    private _localPeerId;
    private _error;
    private attempt;
    private closedByUs;
    private retryTimer;
    private listeners;
    /**
     * Optimistic writes awaiting confirmation, by ref.
     *
     * `id` is stored separately from `before` because rolling back a *create*
     * has no previous value to restore — only an entity to remove — and without
     * the id there is nothing to remove it by.
     */
    private pending;
    private refCounter;
    get state(): ViroReplicationState;
    get localPeerId(): string;
    get error(): string | undefined;
    /** Snapshot of the current state. Safe to hold — it is a copy. */
    getEntities(): ViroReplicatedEntity[];
    get(id: string): ViroReplicatedEntity | undefined;
    subscribe(fn: Listener): () => void;
    connect(config: ViroReplicationConfig): void;
    disconnect(): void;
    /** Take authority. Creates the entity if it does not exist yet. */
    claim(id: string, opts?: ViroWriteOptions): void;
    release(id: string): void;
    /** Merge `fields` into the entity. Creates it if absent. */
    set(id: string, fields: Record<string, unknown>, opts?: ViroWriteOptions): void;
    delete(id: string, opts?: ViroWriteOptions): void;
    /**
     * Empty the room, whoever is holding what.
     *
     * The reset a shared work zone needs, and the one operation that ignores
     * ownership. Issuing a reset as one `delete` per entity cannot work: an owned
     * entity refuses `not-owner`, so exactly the objects somebody is still
     * holding would survive it.
     */
    clear(): void;
    private open;
    private handle;
    private replaceAll;
    private applyDeltas;
    /**
     * What an upsert should become locally, given what this device still has in
     * flight.
     *
     * The relay broadcasts to the sender as well, so a drag writing every 33 ms
     * over a 63 ms round trip has two more writes outstanding by the time the
     * first comes back. Taking that echo puts the object where the hand was two
     * writes ago, and the next write pulls it forward again: on the device doing
     * the dragging that reads as the object trailing the finger and snapping
     * back, the faster the drag the further back. Only the fields are held; the
     * version and owner the server assigned are adopted either way.
     */
    private reconcile;
    /**
     * Retire the oldest optimistic write for `id`, reporting whether there was
     * one.
     *
     * A delta carries no ref, but the relay applies one connection's ops in the
     * order they were sent and broadcasts them in that order, so the nth echo
     * settles the nth write. This is also what bounds `pending`, which is why
     * nothing clears it wholesale: doing that on any delta dropped the record a
     * later rejection of an unrelated write needed to roll back.
     */
    private settleOwnWrite;
    private requestResync;
    private rollback;
    /** Called for every refused operation. */
    onReject?: (rejection: ViroReplicationRejection) => void;
    private send;
    private setState;
    private emit;
}
export {};
