/**
 * ViroText
 *
 * A component for rendering 3D text in the Viro scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroTextProps extends ViroCommonProps {
    text: string;
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "normal" | "bold";
    fontStyle?: "normal" | "italic";
    textAlign?: "left" | "center" | "right";
    textAlignVertical?: "top" | "center" | "bottom";
    textLineBreakMode?: "wordwrap" | "charwrap" | "justify" | "none";
    textClipMode?: "none" | "clipToBounds";
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
    materials?: string | string[];
    extrusionDepth?: number;
    outerStroke?: {
        type?: string;
        width?: number;
        color?: string;
    };
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
}
/**
 * ViroText is a component for rendering 3D text in the Viro scene.
 */
export declare const ViroText: React.FC<ViroTextProps>;
//# sourceMappingURL=ViroText.d.ts.map