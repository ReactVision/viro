/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroThrottledWrite
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIRO_REPLICATION_WRITE_INTERVAL_MS = void 0;
exports.useViroThrottledWrite = useViroThrottledWrite;
exports.viroVec3Settled = viroVec3Settled;
const react_1 = require("react");
/**
 * Milliseconds between replicated writes for one continuously moving thing.
 *
 * The relay allows 120 messages a second per peer on the replication socket and
 * closes the connection at 1008 above it, which also refuses that key for the
 * next 30 seconds, so the ceiling is not one to feel your way up to. 33 ms is
 * 30 a second, leaving room for a second held object, for the claim and release
 * either side of a drag, and for the burst a reconnect sends.
 */
exports.VIRO_REPLICATION_WRITE_INTERVAL_MS = 33;
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
function useViroThrottledWrite(write, options) {
    const { intervalMs = exports.VIRO_REPLICATION_WRITE_INTERVAL_MS, unchanged } = options ?? {};
    const writeRef = (0, react_1.useRef)(write);
    const unchangedRef = (0, react_1.useRef)(unchanged);
    (0, react_1.useEffect)(() => {
        writeRef.current = write;
        unchangedRef.current = unchanged;
    });
    const pending = (0, react_1.useRef)(null);
    const lastSent = (0, react_1.useRef)(null);
    const lastSentAt = (0, react_1.useRef)(0);
    const timer = (0, react_1.useRef)(undefined);
    const send = (0, react_1.useCallback)((value) => {
        lastSent.current = { value };
        lastSentAt.current = Date.now();
        writeRef.current(value);
    }, []);
    const flush = (0, react_1.useCallback)(() => {
        if (timer.current !== undefined) {
            clearTimeout(timer.current);
            timer.current = undefined;
        }
        const held = pending.current;
        pending.current = null;
        if (held)
            send(held.value);
    }, [send]);
    const push = (0, react_1.useCallback)((value) => {
        const settled = unchangedRef.current;
        // The deadband is checked against what actually went out, not against the
        // previous sample: comparing neighbours lets a slow drag creep any
        // distance at all without ever sending, one sub-threshold step at a time.
        if (settled &&
            lastSent.current &&
            settled(lastSent.current.value, value)) {
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
    }, [flush, intervalMs]);
    (0, react_1.useEffect)(() => () => flush(), [flush]);
    return (0, react_1.useMemo)(() => ({ push, flush }), [push, flush]);
}
/** A deadband for positions: below this many metres, do not spend a message. */
function viroVec3Settled(epsilonMetres) {
    return (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < epsilonMetres;
}
