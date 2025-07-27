/**
 * ViroCamera
 *
 * A component for controlling the scene camera.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroCameraProps extends ViroCommonProps {
    fieldOfView?: number;
    focalPoint?: [number, number, number];
    children?: React.ReactNode;
}
/**
 * ViroCamera is a component for controlling the scene camera.
 * It allows customization of camera properties and behavior.
 */
export declare const ViroCamera: React.FC<ViroCameraProps>;
