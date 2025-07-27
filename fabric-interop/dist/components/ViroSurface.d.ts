/**
 * ViroSurface
 *
 * A component for rendering a flat surface in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSurfaceProps extends ViroCommonProps {
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
 * ViroSurface is a component for rendering a flat surface in 3D space.
 * It's similar to ViroQuad but with additional properties for more flexibility.
 */
export declare const ViroSurface: React.FC<ViroSurfaceProps>;
//# sourceMappingURL=ViroSurface.d.ts.map