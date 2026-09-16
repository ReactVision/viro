/** Small vector/quaternion helpers the web components share. */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
/**
 * Rotate a vector by a quaternion: v + 2w(q × v) + 2(q × (q × v)).
 *
 * Only a rotation for a unit quaternion, which is what a tracker reports. A sign
 * error here points a whole camera basis the wrong way — an audio field at the
 * wrong side of the listener, or content placed behind the user — so it has its
 * own test rather than being inlined at each call site.
 */
export declare function rotateByQuaternion(q: Quat, v: Vec3): Vec3;
/** virocore's camera looks down local -Z with +Y up. */
export declare const CAMERA_FORWARD: Vec3;
export declare const CAMERA_UP: Vec3;
/** The camera's world-space forward and up for a tracked orientation. */
export declare function cameraBasis(quaternion: Quat): {
    forward: Vec3;
    up: Vec3;
};
