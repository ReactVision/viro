/**
 * Web implementation of ViroCamera. Creates a node with a camera, positions it
 * via the shared node hook, and (when active) makes it the renderer's point of
 * view. Defaults to active unless `active={false}`.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    active?: boolean;
    projection?: "perspective" | "orthographic";
    orthographicScale?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroCamera(props: Props): React.JSX.Element;
export {};
