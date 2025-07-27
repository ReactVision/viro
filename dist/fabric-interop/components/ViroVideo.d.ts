/**
 * ViroVideo
 *
 * A component for displaying video content in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroVideoProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    width?: number;
    height?: number;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    paused?: boolean;
    resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    onBufferStart?: () => void;
    onBufferEnd?: () => void;
    onFinish?: () => void;
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
    onError?: (error: string) => void;
}
/**
 * ViroVideo is a component for displaying video content in 3D space.
 */
export declare const ViroVideo: React.FC<ViroVideoProps>;
