/**
 * Web implementation of ViroNode — a transform group with no geometry. Creates a
 * native node, applies transform props, and provides its handle as the parent
 * for its children.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroNode(props: Props): React.JSX.Element;
export {};
