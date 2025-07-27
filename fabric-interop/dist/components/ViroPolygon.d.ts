/**
 * ViroPolygon
 *
 * A component for rendering a 2D polygon in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroPolygonProps extends ViroCommonProps {
    vertices: [number, number][];
    holes?: [number, number][][];
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
}
/**
 * ViroPolygon is a component for rendering a 2D polygon in 3D space.
 * It allows you to create complex 2D shapes by specifying a list of vertices.
 * You can also create holes in the polygon by specifying a list of hole vertices.
 */
export declare const ViroPolygon: React.FC<ViroPolygonProps>;
//# sourceMappingURL=ViroPolygon.d.ts.map