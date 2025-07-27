/**
 * ViroSoundField
 *
 * A component for playing ambient audio field in the scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSoundFieldProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    paused?: boolean;
    volume?: number;
    muted?: boolean;
    loop?: boolean;
    rotation?: [number, number, number];
    onFinish?: () => void;
    onError?: (error: string) => void;
}
/**
 * ViroSoundField is a component for playing ambient audio field in the scene.
 * It provides 360-degree ambient audio that surrounds the listener.
 */
export declare const ViroSoundField: React.FC<ViroSoundFieldProps>;
