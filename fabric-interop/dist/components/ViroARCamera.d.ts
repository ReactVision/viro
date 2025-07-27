/**
 * ViroARCamera
 *
 * A component for controlling the camera in an AR scene.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export type ViroARCameraTransformUpdateEvent = {
    position: [number, number, number];
    rotation: [number, number, number];
    forward: [number, number, number];
    up: [number, number, number];
};
export type ViroARTrackingStateEvent = {
    state: "NORMAL" | "LIMITED" | "NOT_AVAILABLE";
    reason?: "NONE" | "INITIALIZING" | "EXCESSIVE_MOTION" | "INSUFFICIENT_FEATURES";
};
export interface ViroARCameraProps extends Omit<ViroCommonProps, "onTransformUpdate"> {
    active?: boolean;
    onTransformUpdate?: (event: ViroARCameraTransformUpdateEvent) => void;
    onTrackingUpdated?: (event: ViroARTrackingStateEvent) => void;
    children?: React.ReactNode;
}
/**
 * ViroARCamera is a component for controlling the camera in an AR scene.
 * It provides information about the camera's position and orientation in the real world,
 * as well as tracking state updates.
 */
export declare const ViroARCamera: React.FC<ViroARCameraProps>;
//# sourceMappingURL=ViroARCamera.d.ts.map