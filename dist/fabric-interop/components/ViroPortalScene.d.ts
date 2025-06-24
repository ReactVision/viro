/**
 * ViroPortalScene
 *
 * A component for portal scene content.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroPortalSceneProps extends ViroCommonProps {
    passable?: boolean;
    children?: React.ReactNode;
}
/**
 * ViroPortalScene is a component for portal scene content.
 * It defines the content that appears inside a portal.
 */
export declare const ViroPortalScene: React.FC<ViroPortalSceneProps>;
