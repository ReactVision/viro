/**
 * ViroQuad
 *
 * A component for rendering a 2D quad in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroQuadProps extends ViroCommonProps {
    width?: number;
    height?: number;
    uvCoordinates?: [
        [
            number,
            number
        ],
        [
            number,
            number
        ],
        [
            number,
            number
        ],
        [
            number,
            number
        ]
    ];
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    arShadowReceiver?: boolean;
}
/**
 * ViroQuad is a component for rendering a 2D quad in 3D space.
 * It's a flat rectangular surface that can be used for various purposes,
 * such as displaying images, videos, or creating simple geometric shapes.
 */
export declare const ViroQuad: React.FC<ViroQuadProps>;
