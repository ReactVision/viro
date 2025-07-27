/**
 * ViroARImageMarker
 *
 * A component for detecting and tracking images in the real world.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroARImageMarkerProps extends ViroCommonProps {
    target: string;
    visible?: boolean;
    opacity?: number;
    onAnchorFound?: () => void;
    onAnchorUpdated?: () => void;
    onAnchorRemoved?: () => void;
    children?: React.ReactNode;
}
/**
 * ViroARImageMarker is a component for detecting and tracking images in the real world.
 * It allows you to attach virtual content to real-world images, such as posters, book covers, or logos.
 */
export declare const ViroARImageMarker: React.FC<ViroARImageMarkerProps>;
//# sourceMappingURL=ViroARImageMarker.d.ts.map