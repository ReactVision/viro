/**
 * The basis vectors the Web Audio listener is pointed with.
 *
 * A sign error here is a sound that pans to the wrong side, which is hard to
 * hear deliberately and easy to write. virocore's camera looks down local -Z
 * with +Y up, so an unrotated pose must come back as exactly that.
 */
import { rotateByQuaternion } from "../components/Web/viroMath";

type Quat = [number, number, number, number];

const IDENTITY: Quat = [0, 0, 0, 1];
/** A quarter turn about +Y, which in a right-handed frame turns -Z toward -X. */
const QUARTER_LEFT: Quat = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const FORWARD: [number, number, number] = [0, 0, -1];
const UP: [number, number, number] = [0, 1, 0];

const close = (got: number[], want: number[]) => {
  got.forEach((n, i) => expect(n).toBeCloseTo(want[i], 6));
};

const normalise = (q: Quat): Quat => {
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};

describe("rotateByQuaternion", () => {
  test("an untracked pose leaves the camera basis alone", () => {
    close(rotateByQuaternion(IDENTITY, FORWARD), [0, 0, -1]);
    close(rotateByQuaternion(IDENTITY, UP), [0, 1, 0]);
  });

  test("a quarter turn about Y swings forward onto the X axis", () => {
    close(rotateByQuaternion(QUARTER_LEFT, FORWARD), [-1, 0, 0]);
    // Up is the axis of rotation, so it does not move.
    close(rotateByQuaternion(QUARTER_LEFT, UP), [0, 1, 0]);
  });

  test("forward and up stay perpendicular and unit length", () => {
    // Web Audio needs an orthonormal pair; a drifting one skews the whole field.
    // Normalised on purpose: the rotation is only a rotation for a unit
    // quaternion, and a tracker's output always is one.
    const tilted = normalise([1, 2, 3, 4]);
    const f = rotateByQuaternion(tilted, FORWARD);
    const u = rotateByQuaternion(tilted, UP);
    const dot = f[0] * u[0] + f[1] * u[1] + f[2] * u[2];
    expect(dot).toBeCloseTo(0, 5);
    expect(Math.hypot(...f)).toBeCloseTo(1, 5);
    expect(Math.hypot(...u)).toBeCloseTo(1, 5);
  });

  test("a half turn reverses forward", () => {
    close(rotateByQuaternion([0, 1, 0, 0], FORWARD), [0, 0, 1]);
  });
});
