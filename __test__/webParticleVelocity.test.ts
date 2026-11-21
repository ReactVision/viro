/**
 * What a web emitter hands the C API: the velocity, from either shape the prop
 * can arrive in, and the settings native applies to a live emitter.
 *
 * The first test is the regression: `initialRange` is what
 * ViroParticleEmitter's own API takes, and reading only `min`/`max` turned
 * every native-authored scene into stationary particles.
 */
import { ViroParticleSpawnShape } from "@reactvision/viro-web-renderer";
import {
  particleBursts,
  particleEmitterConfig,
  particleVelocity,
  velocityRange,
} from "../components/ViroParticleEmitter.web";

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

  test("an emitter with no velocity takes native's default spread", () => {
    const native = [[-0.5, 1, 0], [0.5, 1, 0]];
    expect(particleVelocity(undefined)).toEqual(native);
    expect(particleVelocity({ initialRange: [] })).toEqual(native);
    expect(particleVelocity({ initialRange: [UP] })).toEqual([UP, UP]);
  });
});

describe("particleEmitterConfig", () => {
  const image = { source: "sprite.png" };

  test("unset props take native's defaults", () => {
    const c = particleEmitterConfig({ image });
    expect(c).toMatchObject({
      delay: 0,
      duration: 2000,
      loop: true,
      fixedToEmitter: true,
      blendMode: "Add",
      bloomThreshold: -1,
      emissionRatePerSecond: [10, 10],
      emissionRatePerMeter: [0, 0],
      particleLifetime: [2000, 2000],
      maxParticles: 500,
      bursts: [],
      explosion: null,
    });
    expect(c.spawnVolume).toEqual({ shape: ViroParticleSpawnShape.Point, params: [], onSurface: false });
  });

  test("carries the image's blend and bloom, spawnOnSurface and the explosion", () => {
    const c = particleEmitterConfig({
      image: { ...image, blendMode: "Alpha", bloomThreshold: 0.4 },
      spawnBehavior: { spawnVolume: { shape: "sphere", params: [0.5], spawnOnSurface: true } },
      particlePhysics: { explosiveImpulse: { impulse: 2, position: [0, 1, 0] } },
    });
    expect(c.blendMode).toBe("Alpha");
    expect(c.bloomThreshold).toBe(0.4);
    expect(c.spawnVolume).toEqual({ shape: ViroParticleSpawnShape.Sphere, params: [0.5], onSurface: true });
    // No decelerationPeriod: native passes -1, which the renderer fills in.
    expect(c.explosion).toEqual({ position: [0, 1, 0], impulse: 2, deceleration: undefined });
  });

  test("an explosion without a 3-value position is no explosion, as native refuses it", () => {
    expect(
      particleEmitterConfig({ image, particlePhysics: { explosiveImpulse: { impulse: 2, position: [0, 1] } } }).explosion,
    ).toBeNull();
  });
});

describe("particleBursts", () => {
  test("time and distance bursts, with native's defaults for cooldown and cycles", () => {
    expect(
      particleBursts([
        { time: 500, min: 10, max: 20 },
        { distance: 2, cooldownDistance: 1, min: 5, max: 5, cycles: 3 },
      ]),
    ).toEqual([
      { factor: "time", start: 500, interval: 0, min: 10, max: 20, cycles: 1 },
      { factor: "distance", start: 2, interval: 1, min: 5, max: 5, cycles: 3 },
    ]);
  });

  test("leaves out the entries native refuses", () => {
    expect(
      particleBursts([
        { time: 0, min: 5 },
        { min: 1, max: 2 },
        { time: 0, min: 5, max: 1 },
        { time: 0, min: -1, max: 1 },
        "burst",
      ]),
    ).toEqual([]);
    expect(particleBursts({ time: 0, min: 1, max: 1 })).toEqual([]);
  });
});
