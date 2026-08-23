/**
 * Web implementation of ViroSphere — a node with sphere geometry.
 * Segment counts use the renderer default; radius is read on mount.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    radius?: number;
    widthSegmentCount?: number;
    heightSegmentCount?: number;
    facesOutward?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroSphere(props: Props): React.JSX.Element;
export {};
