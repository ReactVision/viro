/**
 * Half the relay's 120 messages a second per peer, which closes the socket at
 * 1008 above it and refuses the credential for 30 s. The other half is for
 * drags, claims, releases and the scene origin.
 */
export declare const STUDIO_SHARED_WRITES_PER_SECOND = 60;
/** A host's first sync writes every changed row at once; this many go out unpaced. */
export declare const STUDIO_SHARED_WRITE_BURST = 30;
export type StudioOutboxOptions = {
    now?: () => number;
    intervalMs?: number;
    perSecond?: number;
    burst?: number;
};
/** Null fields delete the entity. */
export type StudioOutboxSend = (id: string, fields: Record<string, unknown> | null) => void;
/**
 * Replicated writes, coalesced per entity: one goes out at once, and any made
 * within the next interval collapse into one trailing write of the latest value.
 * Across entities the rate is capped, so a burst queues rather than tripping
 * the relay's limit.
 */
export declare class StudioReplicationOutbox {
    private send;
    private queue;
    private lastSentAt;
    private tokens;
    private refilledAt;
    private timer;
    private flushing;
    private readonly now;
    private readonly intervalMs;
    private readonly perSecond;
    private readonly burst;
    constructor(send: StudioOutboxSend, options?: StudioOutboxOptions);
    /** A value already queued for `id` is replaced and keeps its place in line. */
    write(id: string, fields: Record<string, unknown>): void;
    /** Paced like a write, and replaced by a later write to the same id. */
    remove(id: string): void;
    private enqueue;
    isQueued(id: string): boolean;
    /** Returns the ids whose writes it dropped. */
    clear(): string[];
    dispose(): void;
    private flush;
    private drain;
    private cancelTimer;
}
