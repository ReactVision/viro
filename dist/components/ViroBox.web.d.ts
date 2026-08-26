/**
 * Web implementation of ViroBox — a node with box geometry. Dimensions are read
 * on mount; live dimension changes (rebuilding geometry) are a follow-up.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    width?: number;
    height?: number;
    length?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroBox(props: Props): React.JSX.Element;
export {};
