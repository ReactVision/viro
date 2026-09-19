import {
  approachFactor,
  approachQuat,
  approachVec3,
  isQuat,
  isVec3,
  type ViroQuat,
  type ViroVec3,
} from "../components/AR/ViroSmoothing";

const IDENTITY: ViroQuat = [0, 0, 0, 1];

describe("approachFactor", () => {
  it("covers half the distance in one half-life, whatever the frame rate", () => {
    expect(approachFactor(35, 35)).toBeCloseTo(0.5, 6);
    expect(approachFactor(70, 70)).toBeCloseTo(0.5, 6);
  });

  it("compounds to the same place from different frame rates", () => {
    // 90 Hz against 45 Hz over the same 90 ms: smoothing tuned on a headset has
    // to look the same on a phone, which a fixed per-frame fraction does not.
    const after = (steps: number, dt: number) => {
      let remaining = 1;
      for (let i = 0; i < steps; i++) remaining *= 1 - approachFactor(dt, 35);
      return remaining;
    };
    expect(after(8, 11.1)).toBeCloseTo(after(4, 22.2), 4);
  });

  it("snaps outright when a frame covered many half-lives", () => {
    // An app returning from the background gets one enormous frame. Gliding in
    // from where the room was thirty seconds ago is the wrong answer.
    expect(approachFactor(30_000, 35)).toBe(1);
  });

  it("treats a missing or nonsense half-life as no smoothing", () => {
    expect(approachFactor(16, 0)).toBe(1);
    expect(approachFactor(16, -5)).toBe(1);
    expect(approachFactor(0, 35)).toBe(1);
  });
});

describe("approachVec3", () => {
  it("moves part of the way", () => {
    expect(approachVec3([0, 0, 0], [10, 0, 0], 0.5)).toEqual([5, 0, 0]);
  });

  it("returns the target itself once inside the snap, which is the settled signal", () => {
    const target: ViroVec3 = [1, 2, 3];
    // Identity, not equality: the frame loop uses it to know it can stop, and
    // an exponential approach would otherwise never arrive.
    expect(approachVec3([1, 2, 3.0000001], target, 0.5)).toBe(target);
    expect(approachVec3([0, 0, 0], target, 1)).toBe(target);
  });

  it("keeps approaching while it is still outside the snap", () => {
    const target: ViroVec3 = [1, 0, 0];
    expect(approachVec3([0, 0, 0], target, 0.5)).not.toBe(target);
  });
});

describe("approachQuat", () => {
  it("takes the short way round when the target is the opposite sign", () => {
    // A quaternion and its negation are one rotation. Without the sign flip a
    // peer turning slightly spins the long way to arrive where it nearly was.
    const negatedIdentity: ViroQuat = [0, 0, 0, -1];
    expect(approachQuat(IDENTITY, negatedIdentity, 0.5)).toBe(negatedIdentity);
  });

  it("returns a unit quaternion while blending", () => {
    const target: ViroQuat = [0, 0.7071068, 0, 0.7071068];
    const out = approachQuat(IDENTITY, target, 0.5);
    expect(out).not.toBe(target);
    expect(Math.hypot(...out)).toBeCloseTo(1, 6);
  });

  it("returns the target once the two rotations agree", () => {
    const target: ViroQuat = [0, 0, 0, 1];
    expect(approachQuat([0, 0, 0.0000001, 1], target, 0.5)).toBe(target);
  });
});

describe("shape guards", () => {
  it("rejects anything that is not the arity it claims", () => {
    expect(isVec3([1, 2, 3])).toBe(true);
    expect(isVec3([1, 2])).toBe(false);
    expect(isVec3([1, 2, 3, 4])).toBe(false);
    expect(isQuat([0, 0, 0, 1])).toBe(true);
    expect(isQuat([0, 0, 1])).toBe(false);
  });

  it("rejects non-finite numbers, which would poison every later frame", () => {
    expect(isVec3([1, NaN, 3])).toBe(false);
    expect(isVec3([1, Infinity, 3])).toBe(false);
    expect(isQuat([0, 0, 0, NaN])).toBe(false);
  });

  it("rejects values that are not arrays at all", () => {
    expect(isVec3(undefined)).toBe(false);
    expect(isVec3("1,2,3")).toBe(false);
    expect(isQuat({ x: 0, y: 0, z: 0, w: 1 })).toBe(false);
  });
});
