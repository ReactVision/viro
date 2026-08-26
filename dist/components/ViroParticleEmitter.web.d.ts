import { type ViroWebNodeProps } from "./Web/useViroNode";
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
        velocity?: {
            min?: number[];
            max?: number[];
        };
    };
    [key: string]: any;
};
export declare function ViroParticleEmitter(props: Props): null;
export {};
