/**
 * Turning a `particleAppearance` prop into C API calls.
 *
 * The prop is four properties with four different value shapes behind one name,
 * which is exactly where a silent mistranslation hides: a scalar sent as a
 * vector, a colour sent as a string, degrees sent as radians. Each case below is
 * one of those.
 */
import {
  resolveParticleAppearance,
  resolveFactor,
  VIRO_PARTICLE_INTERVAL_STRIDE,
} from "../components/Web/viroParticleAppearance";
import {
  ViroParticleFactor,
  ViroParticleProperty,
} from "@reactvision/viro-web-renderer";

describe("resolveParticleAppearance", () => {
  test("an absent appearance asks for nothing", () => {
    // Not "every property at its default": a modifier with no interpolation
    // still replaces the particle's initial value with a pick from its range,
    // so a defaulted one would not behave like an absent one.
    expect(resolveParticleAppearance(undefined)).toEqual([]);
    expect(resolveParticleAppearance({})).toEqual([]);
  });

  test("opacity is a scalar and travels in x", () => {
    const [call] = resolveParticleAppearance({
      opacity: {
        initialRange: [1.0, 1.0],
        interpolation: [{ interval: [0, 1000], endValue: 0 }],
      },
    });
    expect(call.property).toBe(ViroParticleProperty.Alpha);
    expect(call.min).toEqual([1, 0, 0]);
    expect(call.max).toEqual([1, 0, 0]);
    expect(call.intervals).toEqual([0, 1000, 0, 0, 0]);
  });

  test("scale keeps its three components", () => {
    const [call] = resolveParticleAppearance({
      scale: {
        initialRange: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        interpolation: [{ interval: [0, 500], endValue: [0.1, 0.1, 0.1] }],
      },
    });
    expect(call.property).toBe(ViroParticleProperty.Scale);
    expect(call.min).toEqual([1, 1, 1]);
    expect(call.max).toEqual([2, 2, 2]);
    expect(call.intervals).toEqual([0, 500, 0.1, 0.1, 0.1]);
  });

  test("rotation is authored in degrees and applied in radians", () => {
    const [call] = resolveParticleAppearance({
      rotation: { initialRange: [0, 180] },
    });
    expect(call.property).toBe(ViroParticleProperty.Rotation);
    expect(call.min).toEqual([0, 0, 0]);
    expect(call.max[0]).toBeCloseTo(Math.PI, 6);
  });

  test("colour arrives as a string and leaves as rgb in 0..1", () => {
    const [call] = resolveParticleAppearance({
      color: {
        initialRange: ["#ff0000", "#0000ff"],
        interpolation: [{ interval: [0, 1000], endValue: "#00ff00" }],
      },
    });
    expect(call.property).toBe(ViroParticleProperty.Color);
    expect(call.min).toEqual([1, 0, 0]);
    expect(call.max).toEqual([0, 0, 1]);
    // Alpha is dropped: virocore drives opacity from its own modifier, and a
    // colour's alpha here would fight it.
    expect(call.intervals).toEqual([0, 1000, 0, 1, 0]);
  });

  test("a one-valued range is a constant, not a range down to zero", () => {
    const [call] = resolveParticleAppearance({ opacity: { initialRange: [0.5] } });
    expect(call.min).toEqual([0.5, 0, 0]);
    expect(call.max).toEqual([0.5, 0, 0]);
  });

  test("an interpolation point with no window is dropped", () => {
    // virocore would interpolate across a zero-length factor range, which is a
    // divide the modifier does not guard.
    const [call] = resolveParticleAppearance({
      opacity: {
        initialRange: [1],
        interpolation: [
          { endValue: 0 },
          { interval: [0], endValue: 0 },
          { interval: [0, 100], endValue: 0.25 },
        ],
      },
    });
    expect(call.intervals).toHaveLength(VIRO_PARTICLE_INTERVAL_STRIDE);
    expect(call.intervals).toEqual([0, 100, 0.25, 0, 0]);
  });

  test("every property named produces exactly one call", () => {
    const calls = resolveParticleAppearance({
      opacity: { initialRange: [1] },
      color: { initialRange: ["#fff"] },
      scale: { initialRange: [[1, 1, 1]] },
      rotation: { initialRange: [0] },
    });
    expect(calls.map((c) => c.property)).toEqual([
      ViroParticleProperty.Alpha,
      ViroParticleProperty.Color,
      ViroParticleProperty.Scale,
      ViroParticleProperty.Rotation,
    ]);
  });
});

describe("resolveFactor", () => {
  test("time is the default, whatever the casing", () => {
    expect(resolveFactor(undefined)).toBe(ViroParticleFactor.Time);
    expect(resolveFactor("Time")).toBe(ViroParticleFactor.Time);
    expect(resolveFactor("nonsense")).toBe(ViroParticleFactor.Time);
  });

  test("distance and velocity are recognised case-insensitively", () => {
    expect(resolveFactor("Distance")).toBe(ViroParticleFactor.Distance);
    expect(resolveFactor("velocity")).toBe(ViroParticleFactor.Velocity);
  });
});
