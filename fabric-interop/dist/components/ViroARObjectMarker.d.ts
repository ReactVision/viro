/**
 * ViroARObjectMarker
 *
 * A component for detecting and tracking 3D objects in the real world.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroARObjectMarkerProps extends ViroCommonProps {
    target: string;
    visible?: boolean;
    opacity?: number;
    onAnchorFound?: () => void;
    onAnchorUpdated?: () => void;
    onAnchorRemoved?: () => void;
    children?: React.ReactNode;
}
/**
 * ViroARObjectMarker is a component for detecting and tracking 3D objects in the real world.
 * It allows you to attach virtual content to real-world objects, such as toys, furniture, or other physical items.
 */
export declare const ViroARObjectMarker: React.FC<ViroARObjectMarkerProps>;
//# sourceMappingURL=ViroARObjectMarker.d.ts.map