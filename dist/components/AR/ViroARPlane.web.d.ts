/**
 * Web implementation of ViroARPlane. Binds to a detected plane (an anchor from
 * the AR session) and renders its children in that plane's local space. Matching
 * is either explicit (anchorId) or automatic (largest unclaimed plane meeting
 * minWidth/minHeight and the requested alignment); the enclosing ViroARScene
 * coordinates claims so two auto planes don't grab the same anchor.
 *
 * The bound node's transform is driven by the anchor each frame; when nothing is
 * matched the node is hidden. onAnchorFound/Updated/Removed fire on transitions.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "../Web/useViroNode";
import { type ViroWebAnchor } from "./ViroARScene.web";
type Props = ViroWebNodeProps & {
    anchorId?: string;
    minWidth?: number;
    minHeight?: number;
    alignment?: "Horizontal" | "HorizontalUpward" | "HorizontalDownward" | "Vertical";
    onAnchorFound?: (anchor: ViroWebAnchor) => void;
    onAnchorUpdated?: (anchor: ViroWebAnchor) => void;
    onAnchorRemoved?: () => void;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroARPlane(props: Props): React.JSX.Element;
export {};
