/**
 * ViroButton
 *
 * A component for creating interactive buttons in 3D space.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroButtonProps extends ViroCommonProps {
    source: {
        uri: string;
    } | number;
    hoverSource?: {
        uri: string;
    } | number;
    clickSource?: {
        uri: string;
    } | number;
    gazeSource?: {
        uri: string;
    } | number;
    width?: number;
    height?: number;
    materials?: string | string[];
    lightReceivingBitMask?: number;
    shadowCastingBitMask?: number;
    children?: React.ReactNode;
}
/**
 * ViroButton is a component for creating interactive buttons in 3D space.
 * It provides visual feedback for different interaction states.
 */
export declare const ViroButton: React.FC<ViroButtonProps>;
