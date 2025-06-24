/**
 * ViroController
 *
 * A component for VR controller interaction.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroControllerProps extends ViroCommonProps {
    controllerVisibility?: boolean;
    reticleVisibility?: boolean;
    onControllerUpdate?: (event: any) => void;
    onMove?: (event: any) => void;
    children?: React.ReactNode;
}
/**
 * ViroController is a component for VR controller interaction.
 * It provides controller tracking and interaction capabilities.
 */
export declare const ViroController: React.FC<ViroControllerProps>;
