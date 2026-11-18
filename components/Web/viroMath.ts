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

/** virocore's Euler-to-quaternion (VROQuaternion::set): Z·Y·X, angles in degrees. */
export function quatFromEulerDegrees(euler: readonly number[]): Quat {
  const half = Math.PI / 360;
  const r = (euler[0] ?? 0) * half;
  const p = (euler[1] ?? 0) * half;
  const y = (euler[2] ?? 0) * half;
  const [sr, cr, sp, cp, sy, cy] = [Math.sin(r), Math.cos(r), Math.sin(p), Math.cos(p), Math.sin(y), Math.cos(y)];
  return [
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  ];
}

/** a·b: rotate by b, then by a. */
export function multiplyQuats(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function conjugateQuat(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}
