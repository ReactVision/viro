/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroThrottledWrite
 */

"use strict";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
export const VIRO_REPLICATION_WRITE_INTERVAL_MS = 33;

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
export function useViroThrottledWrite<T>(
  write: (value: T) => void,
  options?: ViroThrottledWriteOptions<T>
): ViroThrottledWrite<T> {
  const { intervalMs = VIRO_REPLICATION_WRITE_INTERVAL_MS, unchanged } =
    options ?? {};

  const writeRef = useRef(write);
  const unchangedRef = useRef(unchanged);
  useEffect(() => {
    writeRef.current = write;
    unchangedRef.current = unchanged;
  });

  const pending = useRef<{ value: T } | null>(null);
  const lastSent = useRef<{ value: T } | null>(null);
  const lastSentAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const send = useCallback((value: T) => {
    lastSent.current = { value };
    lastSentAt.current = Date.now();
    writeRef.current(value);
  }, []);

  const flush = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
    const held = pending.current;
    pending.current = null;
    if (held) send(held.value);
  }, [send]);

  const push = useCallback(
    (value: T) => {
      const settled = unchangedRef.current;
      // The deadband is checked against what actually went out, not against the
      // previous sample: comparing neighbours lets a slow drag creep any
      // distance at all without ever sending, one sub-threshold step at a time.
      if (
        settled &&
        lastSent.current &&
        settled(lastSent.current.value, value)
      ) {
        return;
      }
      pending.current = { value };
      const since = Date.now() - lastSentAt.current;
      if (since >= intervalMs) {
        flush();
        return;
      }
      if (timer.current === undefined) {
        timer.current = setTimeout(flush, intervalMs - since);
      }
    },
    [flush, intervalMs]
  );

  useEffect(() => () => flush(), [flush]);

  return useMemo(() => ({ push, flush }), [push, flush]);
}

/** A deadband for positions: below this many metres, do not spend a message. */
export function viroVec3Settled(
  epsilonMetres: number
): (a: ViroVec3, b: ViroVec3) => boolean {
  return (a, b) =>
    Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < epsilonMetres;
}
