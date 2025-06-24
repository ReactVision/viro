/**
 * Viro360Image
 *
 * A component for displaying 360-degree images.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface Viro360ImageProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    format?: "RGBA8" | "RGB565";
    isHdr?: boolean;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: string) => void;
}
/**
 * Viro360Image is a component for displaying 360-degree images.
 * It creates an immersive environment using spherical panoramic images.
 */
export declare const Viro360Image: React.FC<Viro360ImageProps>;
