/**
 * The velocity a web emitter hands the C API, from either shape the prop can
 * arrive in.
 *
 * The first test is the regression: `initialRange` is what
 * ViroParticleEmitter's own API takes, and reading only `min`/`max` turned
 * every native-authored scene into stationary particles.
 */
import { velocityRange } from "../components/ViroParticleEmitter.web";

const UP: [number, number, number] = [0, 1, 0];
const UP_FAST: [number, number, number] = [0, 3, 0];

describe("velocityRange", () => {
  test("reads ViroParticleEmitter's initialRange", () => {
    expect(velocityRange({ initialRange: [UP, UP_FAST] })).toEqual([UP, UP_FAST]);
  });

  test("still reads the min/max shape this component shipped with", () => {
    expect(velocityRange({ min: UP, max: UP_FAST })).toEqual([UP, UP_FAST]);
  });

  test("initialRange wins when both are present", () => {
    expect(
      velocityRange({ initialRange: [UP, UP_FAST], min: [9, 9, 9], max: [9, 9, 9] }),
    ).toEqual([UP, UP_FAST]);
  });

  test("one bound is a fixed velocity, not a range from zero", () => {
    // Both shapes: a single vector means every particle leaves at that speed.
    expect(velocityRange({ initialRange: [UP] })).toEqual([UP, UP]);
    expect(velocityRange({ min: UP })).toEqual([UP, UP]);
  });

  test("pads a short vector instead of dropping the whole range", () => {
    expect(velocityRange({ initialRange: [[0, 2]] })).toEqual([
      [0, 2, 0],
      [0, 2, 0],
    ]);
  });

  test("no velocity is still no velocity", () => {
    const still: [number, number, number] = [0, 0, 0];
    expect(velocityRange(undefined)).toEqual([still, still]);
    expect(velocityRange({})).toEqual([still, still]);
    expect(velocityRange({ initialRange: [] })).toEqual([still, still]);
  });
});
