/**
 * Web implementation of ViroPolyline — a line strip through `points` with a
 * given `thickness`. Points may be [x, y] (z defaults to 0) or [x, y, z].
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Point = [number, number] | [number, number, number];
type Props = ViroWebNodeProps & {
    points?: Point[];
    thickness?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroPolyline(props: Props): React.JSX.Element;
export {};
