/**
 * Viro360Video
 *
 * A component for displaying 360-degree videos.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface Viro360VideoProps extends ViroCommonProps {
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
 * Viro360Video is a component for displaying 360-degree videos.
 * It creates an immersive environment using spherical panoramic videos.
 */
export declare const Viro360Video: React.FC<Viro360VideoProps>;
//# sourceMappingURL=Viro360Video.d.ts.map