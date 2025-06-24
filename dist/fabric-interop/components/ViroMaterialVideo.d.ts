/**
 * ViroMaterialVideo
 *
 * A component for using video as a material texture.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroMaterialVideoProps extends ViroCommonProps {
    material: string;
    source: {
        uri: string;
    } | number;
    paused?: boolean;
    loop?: boolean;
    muted?: boolean;
    volume?: number;
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onBufferStart?: () => void;
    onBufferEnd?: () => void;
    onFinish?: () => void;
    onUpdateTime?: (currentTime: number, totalTime: number) => void;
    onError?: (error: string) => void;
}
/**
 * ViroMaterialVideo is a component for using video as a material texture.
 * It allows video content to be applied as a texture to 3D objects.
 */
export declare const ViroMaterialVideo: React.FC<ViroMaterialVideoProps>;
