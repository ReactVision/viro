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
export function rotateByQuaternion(q: Quat, v: Vec3): Vec3 {
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
export const CAMERA_FORWARD: Vec3 = [0, 0, -1];
export const CAMERA_UP: Vec3 = [0, 1, 0];

/** The camera's world-space forward and up for a tracked orientation. */
export function cameraBasis(quaternion: Quat): { forward: Vec3; up: Vec3 } {
  return {
    forward: rotateByQuaternion(quaternion, CAMERA_FORWARD),
    up: rotateByQuaternion(quaternion, CAMERA_UP),
  };
}
