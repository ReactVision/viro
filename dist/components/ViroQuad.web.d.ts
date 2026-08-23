/**
 * Web implementation of ViroQuad — a node with a flat quad geometry (same
 * underlying surface as ViroSurface). Dimensions are read on mount.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    width?: number;
    height?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroQuad(props: Props): React.JSX.Element;
export {};
