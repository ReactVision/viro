import { type ViroWebNodeProps } from "./Web/useViroNode";
import { type ViroParticleAppearanceProp } from "./Web/viroParticleAppearance";
type Vec3 = [number, number, number];
type Props = ViroWebNodeProps & {
    image: {
        source: unknown;
        width?: number;
        height?: number;
    };
    run?: boolean;
    loop?: boolean;
    spawnBehavior?: {
        emissionRatePerSecond?: number[];
        particleLifetime?: number[];
        maxParticles?: number;
        spawnVolume?: {
            shape?: string;
            params?: number[];
        };
    };
    particlePhysics?: {
        velocity?: VelocityRange;
        acceleration?: VelocityRange;
    };
    /** Colour, opacity, scale and rotation over the particle's life. */
    particleAppearance?: ViroParticleAppearanceProp;
    [key: string]: any;
};
/** Both `velocity` and `acceleration` take this shape. */
type VelocityRange = {
    /** ViroParticleEmitter's own shape: a [min, max] pair of vectors. */
    initialRange?: number[][];
    /** The shape this web component shipped with. */
    min?: number[];
    max?: number[];
};
/**
 * The velocity range, from either shape it can arrive in.
 *
 * `initialRange` is what ViroParticleEmitter's own API takes, so it is what
 * every scene written against the native component sends. This read only
 * `min`/`max`, so those scenes resolved to [0, 0, 0] and their particles were
 * born and died on the emitter — no warning, and the emitter itself still drew,
 * so it looked like it worked. `initialRange` wins where both are present.
 *
 * A range with one entry is a fixed velocity, not a range from zero.
 */
export declare function velocityRange(velocity?: VelocityRange): [Vec3, Vec3];
export declare function ViroParticleEmitter(props: Props): null;
export {};
