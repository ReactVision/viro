/**
 * ViroSphere
 *
 * A 3D sphere component with customizable radius and materials.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSphereProps extends ViroCommonProps {
    radius?: number;
    facesCount?: number;
    segmentCount?: number;
    widthSegmentCount?: number;
    heightSegmentCount?: number;
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    highAccuracyEvents?: boolean;
}
/**
 * ViroSphere is a 3D sphere component with customizable radius and materials.
 */
export declare const ViroSphere: React.FC<ViroSphereProps>;
//# sourceMappingURL=ViroSphere.d.ts.map