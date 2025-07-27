/**
 * ViroPolyline
 *
 * A component for rendering a 3D polyline.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroPolylineProps extends ViroCommonProps {
    points: [number, number, number][];
    thickness?: number;
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
}
/**
 * ViroPolyline is a component for rendering a 3D polyline.
 * It allows you to create a line that connects a series of points in 3D space.
 */
export declare const ViroPolyline: React.FC<ViroPolylineProps>;
//# sourceMappingURL=ViroPolyline.d.ts.map