/**
 * ViroPortal
 *
 * A component for creating portal entrances.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroPortalProps extends ViroCommonProps {
    passable?: boolean;
    children?: React.ReactNode;
}
/**
 * ViroPortal is a component for creating portal entrances.
 * It allows users to transition between different scenes or environments.
 */
export declare const ViroPortal: React.FC<ViroPortalProps>;
