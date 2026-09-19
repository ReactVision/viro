/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroSmoothing
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SNAP_EPSILON = void 0;
exports.approachFactor = approachFactor;
exports.isVec3 = isVec3;
exports.isQuat = isQuat;
exports.approachVec3 = approachVec3;
exports.approachQuat = approachQuat;
/** Metres, and the radian-ish quaternion distance, below which a value is there. */
exports.DEFAULT_SNAP_EPSILON = 0.001;
/**
 * How far to move toward a target this frame, as a fraction.
 *
 * Expressed as a half-life rather than a per-frame fraction because a fixed
 * fraction moves twice as fast on a 90 Hz headset as on a 45 Hz phone, which is
 * how smoothing gets tuned on one device and looks wrong on the other. A frame
 * long enough to cover several half-lives returns 1, so an app coming back from
 * the background snaps rather than gliding in from wherever it was.
 */
function approachFactor(dtMs, halfLifeMs) {
    if (!(halfLifeMs > 0) || !(dtMs > 0))
        return 1;
    return 1 - Math.pow(2, -dtMs / halfLifeMs);
}
function isVec3(value) {
    return (Array.isArray(value) &&
        value.length === 3 &&
        value.every((n) => Number.isFinite(n)));
}
function isQuat(value) {
    return (Array.isArray(value) &&
        value.length === 4 &&
        value.every((n) => Number.isFinite(n)));
}
/**
 * Move a position toward its target, returning `target` itself once it arrives.
 *
 * That identity is the settled signal: exponential approach never exactly
 * reaches anything, so without a snap a released object would sit a fraction of
 * a millimetre off the authoritative position for the life of the session, and
 * the frame loop would keep re-rendering to get there.
 */
function approachVec3(current, target, factor, snapEpsilon = exports.DEFAULT_SNAP_EPSILON) {
    const dx = target[0] - current[0];
    const dy = target[1] - current[1];
    const dz = target[2] - current[2];
    if (factor >= 1 || Math.hypot(dx, dy, dz) <= snapEpsilon)
        return target;
    return [
        current[0] + dx * factor,
        current[1] + dy * factor,
        current[2] + dz * factor,
    ];
}
/**
 * The same for an orientation, over the shorter of the two arcs.
 *
 * A quaternion and its negation are the same rotation, so without the sign flip
 * a peer turning slightly can be interpolated the long way round and spin
 * through 300 degrees to arrive somewhere it already nearly was. Normalised
 * lerp rather than true slerp: at the angles between two samples a tenth of a
 * second apart the difference is not visible, and it costs no trigonometry.
 */
function approachQuat(current, target, factor, snapEpsilon = exports.DEFAULT_SNAP_EPSILON) {
    let dot = current[0] * target[0] +
        current[1] * target[1] +
        current[2] * target[2] +
        current[3] * target[3];
    const sign = dot < 0 ? -1 : 1;
    dot = Math.abs(dot);
    if (factor >= 1 || dot >= 1 - snapEpsilon)
        return target;
    const out = [];
    for (let i = 0; i < 4; i++) {
        out.push(current[i] + (target[i] * sign - current[i]) * factor);
    }
    const len = Math.hypot(out[0], out[1], out[2], out[3]);
    if (!(len > 1e-6))
        return target;
    return [out[0] / len, out[1] / len, out[2] / len, out[3] / len];
}
