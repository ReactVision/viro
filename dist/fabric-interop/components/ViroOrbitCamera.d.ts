/**
 * ViroOrbitCamera
 *
 * A component for orbital camera controls.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroOrbitCameraProps extends ViroCommonProps {
    focalPoint?: [number, number, number];
    distance?: number;
    children?: React.ReactNode;
}
/**
 * ViroOrbitCamera is a component for orbital camera controls.
 * It allows the camera to orbit around a focal point.
 */
export declare const ViroOrbitCamera: React.FC<ViroOrbitCameraProps>;
