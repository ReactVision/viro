/**
 * Copyright © 2026 ReactVision
 *
 * Location-frame maths for co-located AR.
 *
 * A resolved cloud anchor defines a *location frame*: an origin every device in
 * the space agrees on. World coordinates do not survive the trip between
 * devices — each AR session picks its own origin wherever tracking started — so
 * anything two devices exchange (a placed object, a peer's pose) has to be
 * expressed in this frame and converted on arrival.
 *
 * That is the whole contract: **send location-frame coordinates, never world
 * coordinates.**
 *
 * @providesModule ViroLocationFrame
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLocationTransform = parseLocationTransform;
exports.locationToWorld = locationToWorld;
exports.worldToLocation = worldToLocation;
exports.invertTransform = invertTransform;
/**
 * Parse the opaque transform token handed back by `resolveCloudAnchor()` or
 * `finishScan()`.
 *
 * The token stays opaque for the mesh APIs — pass it straight through to
 * `loadWorldMeshFromFile()` / `snapshotWorldMeshToFile()` rather than
 * round-tripping it through here.
 *
 * @returns the 16 floats, or `null` when the token is malformed.
 */
function parseLocationTransform(token) {
    if (!token)
        return null;
    const parts = token.split(",");
    if (parts.length !== 16)
        return null;
    const out = new Array(16);
    for (let i = 0; i < 16; i++) {
        const v = parseFloat(parts[i]);
        if (!isFinite(v))
            return null;
        out[i] = v;
    }
    return out;
}
/**
 * Location frame → world. Use on a position that arrived from another device.
 */
function locationToWorld(transform, point) {
    const [x, y, z] = point;
    return [
        transform[0] * x + transform[4] * y + transform[8] * z + transform[12],
        transform[1] * x + transform[5] * y + transform[9] * z + transform[13],
        transform[2] * x + transform[6] * y + transform[10] * z + transform[14],
    ];
}
/**
 * World → location frame. Use on a position before sending it to another device.
 */
function worldToLocation(transform, point) {
    const inv = invertTransform(transform);
    if (!inv)
        return null;
    return locationToWorld(inv, point);
}
/**
 * General 4×4 inverse.
 *
 * A rigid transform could be inverted far more cheaply, but the resolved
 * transform is not guaranteed rigid — the resolve path composes scale into it —
 * and a transpose-based shortcut would silently produce wrong positions in that
 * case rather than failing.
 *
 * @returns null for a singular matrix.
 */
function invertTransform(m) {
    const inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15]
        + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15]
        - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15]
        + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14]
        - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15]
        - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15]
        + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15]
        - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14]
        + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15]
        + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15]
        - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15]
        + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14]
        - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11]
        - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11]
        + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11]
        - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10]
        + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (det === 0 || !isFinite(det))
        return null;
    const d = 1.0 / det;
    for (let i = 0; i < 16; i++)
        inv[i] *= d;
    return inv;
}
