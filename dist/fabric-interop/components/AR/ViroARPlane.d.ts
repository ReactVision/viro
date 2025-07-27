/**
 * ViroARPlane
 *
 * Container for Viro Components anchored to a detected plane.
 */
import * as React from "react";
import { ViroCommonProps, ViroObjectProps } from "./ViroCommonProps";
import { ViroAnchorFoundMap, ViroAnchorUpdatedMap } from "../Types/ViroEvents";
type Props = ViroCommonProps & ViroObjectProps & {
    anchorId?: string;
    minHeight?: number;
    minWidth?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
    onAnchorFound?: (anchorMap: ViroAnchorFoundMap) => void;
    onAnchorUpdated?: (anchorMap: ViroAnchorUpdatedMap) => void;
    onAnchorRemoved?: () => void;
};
/**
 * Container for Viro Components anchored to a detected plane.
 */
export declare function ViroARPlane(props: Props): React.ReactElement;
export {};
