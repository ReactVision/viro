/**
 * ViroSound
 *
 * A component for playing audio in the scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSoundProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    paused?: boolean;
    volume?: number;
    muted?: boolean;
    loop?: boolean;
    onFinish?: () => void;
    onError?: (error: string) => void;
}
/**
 * ViroSound is a component for playing audio in the scene.
 * It provides basic audio playback functionality.
 */
export declare const ViroSound: React.FC<ViroSoundProps>;
