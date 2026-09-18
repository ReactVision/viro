/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroThrottledWrite
 */
import type { ViroVec3 } from "../AR/ViroSmoothing";
/**
 * Milliseconds between replicated writes for one continuously moving thing.
 *
 * The relay allows 120 messages a second per peer on the replication socket and
 * closes the connection at 1008 above it, which also refuses that key for the
 * next 30 seconds, so the ceiling is not one to feel your way up to. 33 ms is
 * 30 a second, leaving room for a second held object, for the claim and release
 * either side of a drag, and for the burst a reconnect sends.
 */
export declare const VIRO_REPLICATION_WRITE_INTERVAL_MS = 33;
export type ViroThrottledWriteOptions<T> = {
    intervalMs?: number;
    /**
     * Return true when the new value is too close to the last one sent to be
     * worth a message. Placing something precisely is mostly slow movement, so
     * this is where most of the traffic goes, and it costs no latency.
     */
    unchanged?: (lastSent: T, next: T) => boolean;
};
export type ViroThrottledWrite<T> = {
    /** Offer a value. Sent now, or on the trailing edge of the interval. */
    push: (value: T) => void;
    /** Send whatever is pending immediately. Call before releasing ownership. */
    flush: () => void;
};
/**
 * Rate-limit a replicated write without losing the last one.
 *
 * Drag callbacks arrive every frame, which is 72 to 90 a second on a headset
 * and well over what the relay accepts. Throttling alone would drop the final
 * position and leave the object a frame short of where the hand let go on every
 * other device, so a value that arrives inside the interval is held and sent on
 * the trailing edge.
 *
 * ```tsx
 * const write = useViroThrottledWrite(
 *   (position: ViroVec3) => replication.set(id, { position }, { optimistic: true }),
 *   { unchanged: viroVec3Settled(0.002) }
 * );
 * // onDrag: write.push(positionInFrame)
 * // on release: write.flush(); replication.release(id);
 * ```
 *
 * Anything pending is flushed on unmount, so a scene torn down mid-drag still
 * leaves the object where it was left rather than where it was last sampled.
 */
export declare function useViroThrottledWrite<T>(write: (value: T) => void, options?: ViroThrottledWriteOptions<T>): ViroThrottledWrite<T>;
/** A deadband for positions: below this many metres, do not spend a message. */
export declare function viroVec3Settled(epsilonMetres: number): (a: ViroVec3, b: ViroVec3) => boolean;
