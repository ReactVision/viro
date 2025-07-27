/**
 * ViroGeometry
 *
 * A component for rendering custom 3D geometry.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroGeometryProps extends ViroCommonProps {
    vertices: [number, number, number][];
    normals?: [number, number, number][];
    texcoords?: [number, number][];
    triangleIndices: number[][];
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    type?: "Dynamic" | "Kinematic" | "Static";
}
/**
 * ViroGeometry is a component for rendering custom 3D geometry.
 * It allows you to create custom 3D shapes by specifying vertices, normals,
 * texture coordinates, and triangle indices.
 */
export declare const ViroGeometry: React.FC<ViroGeometryProps>;
