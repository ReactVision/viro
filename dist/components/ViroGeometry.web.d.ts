/**
 * Web implementation of ViroGeometry — a custom mesh from `vertices`,
 * `normals`, `texcoords` and `triangleIndices`. Indices are triples [a, b, c].
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type P3 = [number, number, number];
type P2 = [number, number];
type Props = ViroWebNodeProps & {
    vertices?: P3[];
    normals?: P3[];
    texcoords?: P2[];
    triangleIndices?: P3[];
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroGeometry(props: Props): React.JSX.Element;
export {};
