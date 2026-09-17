"use strict";
/** Small vector/quaternion helpers the web components share. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMERA_UP = exports.CAMERA_FORWARD = void 0;
exports.rotateByQuaternion = rotateByQuaternion;
exports.cameraBasis = cameraBasis;
/**
 * Rotate a vector by a quaternion: v + 2w(q × v) + 2(q × (q × v)).
 *
 * Only a rotation for a unit quaternion, which is what a tracker reports. A sign
 * error here points a whole camera basis the wrong way — an audio field at the
 * wrong side of the listener, or content placed behind the user — so it has its
 * own test rather than being inlined at each call site.
 */
function rotateByQuaternion(q, v) {
    const [x, y, z, w] = q;
    const [vx, vy, vz] = v;
    const tx = 2 * (y * vz - z * vy);
    const ty = 2 * (z * vx - x * vz);
    const tz = 2 * (x * vy - y * vx);
    return [
        vx + w * tx + (y * tz - z * ty),
        vy + w * ty + (z * tx - x * tz),
        vz + w * tz + (x * ty - y * tx),
    ];
}
/** virocore's camera looks down local -Z with +Y up. */
exports.CAMERA_FORWARD = [0, 0, -1];
exports.CAMERA_UP = [0, 1, 0];
/** The camera's world-space forward and up for a tracked orientation. */
function cameraBasis(quaternion) {
    return {
        forward: rotateByQuaternion(quaternion, exports.CAMERA_FORWARD),
        up: rotateByQuaternion(quaternion, exports.CAMERA_UP),
    };
}
