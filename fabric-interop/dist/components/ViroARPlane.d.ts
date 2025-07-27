/**
 * ViroARPlane
 *
 * A component for rendering AR planes detected by the AR system.
 */
import React from "react";
import { ViroCommonProps } from "./ViroUtils";
export interface ViroARPlaneProps extends ViroCommonProps {
    alignment?: "Horizontal" | "Vertical";
    minHeight?: number;
    minWidth?: number;
    visible?: boolean;
    opacity?: number;
    materials?: string | string[];
    onAnchorFound?: () => void;
    onAnchorUpdated?: () => void;
    onAnchorRemoved?: () => void;
    children?: React.ReactNode;
}
/**
 * ViroARPlane is a component for rendering AR planes detected by the AR system.
 * It represents a real-world surface detected by the AR system, such as a floor, table, or wall.
 */
export declare const ViroARPlane: React.FC<ViroARPlaneProps>;
//# sourceMappingURL=ViroARPlane.d.ts.map