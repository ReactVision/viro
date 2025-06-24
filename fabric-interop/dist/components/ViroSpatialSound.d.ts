/**
 * ViroSpatialSound
 *
 * A component for playing 3D positioned audio in the scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSpatialSoundProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    paused?: boolean;
    volume?: number;
    muted?: boolean;
    loop?: boolean;
    minDistance?: number;
    maxDistance?: number;
    rolloffModel?: "linear" | "exponential" | "logarithmic";
    distanceRolloffFactor?: number;
    onFinish?: () => void;
    onError?: (error: string) => void;
}
/**
 * ViroSpatialSound is a component for playing 3D positioned audio in the scene.
 * It provides spatial audio that changes based on the listener's position relative to the sound source.
 */
export declare const ViroSpatialSound: React.FC<ViroSpatialSoundProps>;
//# sourceMappingURL=ViroSpatialSound.d.ts.map