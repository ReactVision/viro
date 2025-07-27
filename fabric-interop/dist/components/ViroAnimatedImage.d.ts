/**
 * ViroAnimatedImage
 *
 * A component for displaying animated images.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroAnimatedImageProps extends ViroCommonProps {
    source: {
        uri: string;
    }[] | number[];
    loop?: boolean;
    delay?: number;
    visible?: boolean;
    opacity?: number;
    width?: number;
    height?: number;
    materials?: string | string[];
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    onError?: (error: string) => void;
    onFinish?: () => void;
}
/**
 * ViroAnimatedImage is a component for displaying animated images.
 * It can be used to create simple animations by cycling through a series of images.
 */
export declare const ViroAnimatedImage: React.FC<ViroAnimatedImageProps>;
//# sourceMappingURL=ViroAnimatedImage.d.ts.map