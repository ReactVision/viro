/**
 * Web implementation of ViroPolygon — a filled polygon from `vertices` (2D
 * [x, y] points in the polygon's local plane; z is 0). Holes are a follow-up.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Point2 = [number, number];
type Props = ViroWebNodeProps & {
    vertices: Point2[];
    holes?: Point2[][];
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroPolygon(props: Props): React.JSX.Element;
export {};
