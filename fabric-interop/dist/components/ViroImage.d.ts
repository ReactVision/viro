/**
 * ViroImage
 *
 * A component for displaying 2D images in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroImageProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    width?: number;
    height?: number;
    resizeMode?: "ScaleToFill" | "ScaleToFit" | "StretchToFill";
    imageClipMode?: "None" | "ClipToBounds";
    stereoMode?: "LeftRight" | "RightLeft" | "TopBottom" | "BottomTop" | "None";
    format?: "RGBA8" | "RGB565";
    mipmap?: boolean;
    placeholderSource?: {
        uri: string;
    } | number;
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
}
/**
 * ViroImage is a component for displaying 2D images in 3D space.
 */
export declare const ViroImage: React.FC<ViroImageProps>;
//# sourceMappingURL=ViroImage.d.ts.map