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

import { Viro3DPoint } from "../Types/ViroUtils";

/**
 * The 16 floats behind a `resolvedTransform` / `locationTransform` token.
 *
 * Column-major, matching `VROMatrix4f::getArray()` on both platforms
 * (`rvMatrixToCsv` on iOS, `rvMatrixToCsvJNI` on Android): elements 12, 13 and
 * 14 are the translation.
 */
export type ViroLocationTransform = number[];

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
export function parseLocationTransform(
  token: string | undefined | null
): ViroLocationTransform | null {
  if (!token) return null;

  const parts = token.split(",");
  if (parts.length !== 16) return null;

  const out = new Array<number>(16);
  for (let i = 0; i < 16; i++) {
    const v = parseFloat(parts[i]);
    if (!isFinite(v)) return null;
    out[i] = v;
  }
  return out;
}

/**
 * Location frame → world. Use on a position that arrived from another device.
 */
export function locationToWorld(
  transform: ViroLocationTransform,
  point: Viro3DPoint
): Viro3DPoint {
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
export function worldToLocation(
  transform: ViroLocationTransform,
  point: Viro3DPoint
): Viro3DPoint | null {
  const inv = invertTransform(transform);
  if (!inv) return null;
  return locationToWorld(inv, point);
}

/**
 * A direction through a transform, ignoring where the frame's origin sits.
 *
 * `locationToWorld` moves a *point*, which is right for a position and wrong
 * for a basis vector: a forward vector put through it comes back displaced by
 * the origin, so an avatar built from it faces a direction that drifts with the
 * frame. Only the rotation applies to a direction, which is the upper 3x3.
 */
export function transformDirection(
  transform: ViroLocationTransform,
  direction: Viro3DPoint
): Viro3DPoint {
  const [x, y, z] = direction;
  return [
    transform[0] * x + transform[4] * y + transform[8] * z,
    transform[1] * x + transform[5] * y + transform[9] * z,
    transform[2] * x + transform[6] * y + transform[10] * z,
  ];
}

function normalise(v: Viro3DPoint): Viro3DPoint {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (!(length > 1e-6)) return [0, 0, 1];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function cross(a: Viro3DPoint, b: Viro3DPoint): Viro3DPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * The 16-float pose string the co-location channel carries, from a position and
 * a look direction. Everything passed in is already location-frame.
 *
 * Built from the camera's own forward and up rather than from Euler angles:
 * a triple of angles needs a convention to mean anything, the convention
 * differs between the editor, the renderer and the scene graph, and the wrong
 * one produces an avatar that is subtly wrong in a way nobody notices until
 * they are standing in the room. Two basis vectors have no convention to get
 * wrong.
 *
 * The camera looks down its own -Z, so the +Z basis is the negated forward.
 * Reversing that points every avatar away from where its device is pointing.
 */
export function poseCsv(
  position: Viro3DPoint,
  forward: Viro3DPoint,
  up: Viro3DPoint
): string {
  const z = normalise([-forward[0], -forward[1], -forward[2]]);
  let x = cross(up, z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-6) {
    // Looking straight up or down: `up` is parallel to z and the cross product
    // collapses. Any perpendicular axis will do, since roll is unobservable.
    x = cross([0, 0, 1], z);
  }
  x = normalise(x);
  const y = cross(z, x);

  const m = [
    x[0],
    x[1],
    x[2],
    0,
    y[0],
    y[1],
    y[2],
    0,
    z[0],
    z[1],
    z[2],
    0,
    position[0],
    position[1],
    position[2],
    1,
  ];
  return m.map((n) => (Number.isFinite(n) ? n.toFixed(6) : "0")).join(",");
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
export function invertTransform(
  m: ViroLocationTransform
): ViroLocationTransform | null {
  const inv = new Array<number>(16);

  inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15]
         + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
  inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15]
         - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
  inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15]
         + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
  inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14]
         - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
  inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15]
         - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
  inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15]
         + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
  inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15]
         - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
  inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14]
         + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
  inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15]
         + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
  inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15]
         - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
  inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15]
         + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
  inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14]
         - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
  inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11]
         - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
  inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11]
         + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
  inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11]
         - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
  inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10]
         + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];

  const det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
  if (det === 0 || !isFinite(det)) return null;

  const d = 1.0 / det;
  for (let i = 0; i < 16; i++) inv[i] *= d;
  return inv;
}
