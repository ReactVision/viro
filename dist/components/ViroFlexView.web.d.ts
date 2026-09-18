/**
 * Web implementation of ViroFlexView — a rectangular container in 3D space with
 * an optional background (color or materials), sized by `style.width`/`height`,
 * that lays its children out with flexbox.
 *
 * The layout is measured, not computed here: see Web/viroFlexLayout. Each child
 * gets a node of its own, positioned at the frame the layout gave it, and its
 * measured size travels down the ViroFlexSlot context for the child to rebuild
 * its geometry from — which is the same pair native pushes onto a laid-out
 * child from VRTNode's recalcLayout.
 *
 * A child that declares `position` absolutely is still laid out; it is CSS
 * `position: absolute` that takes it out of flow, exactly as in a stylesheet.
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
