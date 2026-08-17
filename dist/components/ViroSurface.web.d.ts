/**
 * Web implementation of ViroSurface — a node with a flat quad (surface)
 * geometry. Dimensions are read on mount.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    width?: number;
    height?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroSurface(props: Props): React.JSX.Element;
export {};
