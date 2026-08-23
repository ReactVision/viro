/**
 * Web implementation of ViroFlexView — a rectangular container in 3D space with
 * an optional background (color or materials), sized by `style.width`/`height`.
 * Children render under the container node.
 *
 * MVP scope: sized container + background + children. Automatic flexbox layout
 * (flexDirection/justifyContent/alignItems/padding) is a follow-up — children
 * position themselves via their own transform for now.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    style?: {
        width?: number;
        height?: number;
        backgroundColor?: string;
    } & Record<string, unknown>;
    width?: number;
    height?: number;
    materials?: string | string[];
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroFlexView(props: Props): React.JSX.Element;
export {};
