/**
 * ViroSpinner
 *
 * A component for displaying loading spinners in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroSpinnerProps extends ViroCommonProps {
    type?: "light" | "dark";
    size?: "small" | "large";
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
}
/**
 * ViroSpinner is a component for displaying loading spinners in 3D space.
 * It provides visual feedback during loading operations.
 */
export declare const ViroSpinner: React.FC<ViroSpinnerProps>;
