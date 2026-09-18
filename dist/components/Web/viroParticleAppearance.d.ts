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
import { ViroParticleFactor, ViroParticleProperty, VIRO_PARTICLE_INTERVAL_STRIDE } from "@reactvision/viro-web-renderer";
type Vec3 = [number, number, number];
export type ViroParticleModifierCall = {
    property: ViroParticleProperty;
    min: Vec3;
    max: Vec3;
    factor: ViroParticleFactor;
    /** Flattened at VIRO_PARTICLE_INTERVAL_STRIDE floats per point. */
    intervals: number[];
};
type Interpolation = {
    interval?: number[];
    endValue?: unknown;
};
type Modifier = {
    initialRange?: unknown;
    factor?: string;
    interpolation?: Interpolation[];
};
export type ViroParticleAppearanceProp = {
    opacity?: Modifier;
    scale?: Modifier;
    rotation?: Modifier;
    color?: Modifier;
};
export declare function resolveFactor(factor?: string): ViroParticleFactor;
/**
 * The modifier calls an appearance prop asks for, in prop order. A property the
 * prop does not name produces no call at all.
 */
export declare function resolveParticleAppearance(appearance: ViroParticleAppearanceProp | undefined): ViroParticleModifierCall[];
export { VIRO_PARTICLE_INTERVAL_STRIDE };
