"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIRO_PARTICLE_INTERVAL_STRIDE = void 0;
exports.resolveFactor = resolveFactor;
exports.resolveParticleAppearance = resolveParticleAppearance;
/**
 * Turning a `particleAppearance` prop into the calls the C API takes.
 *
 * virocore models all four properties the same way — an initial [min, max] range
 * to randomise from, a reference factor, and interpolation points to move
 * towards — but the prop does not: opacity and rotation carry scalars, scale
 * carries vectors, colour carries colour strings, and each one names its
 * `initialRange` differently in shape if not in name. This is where that is
 * flattened, so the emitter component only has to make the calls.
 *
 * Nothing here defaults a missing property into a modifier. A modifier with no
 * interpolation points still overrides the particle's initial value with a
 * random pick from its range, so inventing one would make an unset property
 * behave differently from an absent one, which is how particles end up
 * mysteriously half-transparent.
 */
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
Object.defineProperty(exports, "VIRO_PARTICLE_INTERVAL_STRIDE", { enumerable: true, get: function () { return viro_web_renderer_1.VIRO_PARTICLE_INTERVAL_STRIDE; } });
const viroColor_1 = require("./viroColor");
function resolveFactor(factor) {
    switch ((factor ?? "").toLowerCase()) {
        case "distance":
            return viro_web_renderer_1.ViroParticleFactor.Distance;
        case "velocity":
            return viro_web_renderer_1.ViroParticleFactor.Velocity;
        default:
            // Native's own default, and what every Studio scene relies on.
            return viro_web_renderer_1.ViroParticleFactor.Time;
    }
}
/** A scalar reaches virocore as a vector; only x is read for alpha and rotation. */
const scalarToVec3 = (n) => typeof n === "number" ? [n, 0, 0] : [0, 0, 0];
const arrayToVec3 = (a) => Array.isArray(a)
    ? [Number(a[0]) || 0, Number(a[1]) || 0, Number(a[2]) || 0]
    : [0, 0, 0];
const colorToVec3 = (c) => {
    if (typeof c !== "string" && typeof c !== "number")
        return [1, 1, 1];
    const [r, g, b] = (0, viroColor_1.parseColorToRGBA)(c);
    // Alpha is dropped: virocore has a separate alpha modifier, and folding a
    // colour's alpha in here would fight it.
    return [r, g, b];
};
/** How each property reads one of its values, initial range and endValue alike. */
const READERS = {
    opacity: { property: viro_web_renderer_1.ViroParticleProperty.Alpha, read: scalarToVec3 },
    color: { property: viro_web_renderer_1.ViroParticleProperty.Color, read: colorToVec3 },
    scale: { property: viro_web_renderer_1.ViroParticleProperty.Scale, read: arrayToVec3 },
    rotation: { property: viro_web_renderer_1.ViroParticleProperty.Rotation, read: scalarToVec3 },
};
const DEG2RAD = Math.PI / 180;
/**
 * The modifier calls an appearance prop asks for, in prop order. A property the
 * prop does not name produces no call at all.
 */
function resolveParticleAppearance(appearance) {
    if (!appearance)
        return [];
    const calls = [];
    for (const key of Object.keys(READERS)) {
        const modifier = appearance[key];
        if (!modifier)
            continue;
        const { property, read } = READERS[key];
        // Rotation is authored in degrees on every Viro surface and applied in
        // radians by the renderer.
        const convert = key === "rotation"
            ? (v) => {
                const [x, y, z] = read(v);
                return [x * DEG2RAD, y * DEG2RAD, z * DEG2RAD];
            }
            : read;
        const range = Array.isArray(modifier.initialRange) ? modifier.initialRange : [];
        const min = convert(range[0]);
        // A single-valued range is a constant, not a range from the value to zero.
        const max = range.length > 1 ? convert(range[1]) : min;
        const intervals = [];
        for (const point of modifier.interpolation ?? []) {
            const interval = Array.isArray(point?.interval) ? point.interval : [];
            // A point with no window spans nothing and would make virocore interpolate
            // across a zero-length factor range.
            if (interval.length < 2)
                continue;
            const [x, y, z] = convert(point.endValue);
            intervals.push(Number(interval[0]) || 0, Number(interval[1]) || 0, x, y, z);
        }
        calls.push({
            property,
            min,
            max,
            factor: resolveFactor(modifier.factor),
            intervals,
        });
    }
    return calls;
}
