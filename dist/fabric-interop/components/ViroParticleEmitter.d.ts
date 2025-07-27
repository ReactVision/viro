/**
 * ViroParticleEmitter
 *
 * A component for creating particle effects.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroParticleEmitterProps extends ViroCommonProps {
    duration?: number;
    delay?: number;
    loop?: boolean;
    run?: boolean;
    fixedToEmitter?: boolean;
    image?: {
        source: {
            uri: string;
        } | number;
        height?: number;
        width?: number;
        bloomThreshold?: number;
    };
    spawnBehavior?: {
        particleLifetime?: [number, number];
        emissionRatePerSecond?: [number, number];
        emissionRatePerMeter?: [number, number];
        spawnVolume?: {
            shape: "box" | "sphere";
            params?: [number, number, number];
            spawnOnSurface?: boolean;
        };
        maxParticles?: number;
    };
    particleAppearance?: {
        opacity?: [number, number];
        rotation?: [number, number];
        rotationSpeed?: [number, number];
        scale?: [number, number, number, number];
        color?: [number, number, number, number];
    };
    particlePhysics?: {
        velocity?: [number, number, number, number, number, number];
        acceleration?: [number, number, number, number, number, number];
        explosiveImpulse?: [number, number];
    };
    onFinish?: () => void;
}
/**
 * ViroParticleEmitter is a component for creating particle effects.
 * It provides a flexible system for creating various particle-based visual effects.
 */
export declare const ViroParticleEmitter: React.FC<ViroParticleEmitterProps>;
