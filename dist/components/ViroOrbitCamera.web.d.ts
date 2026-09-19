/**
 * Web implementation of ViroOrbitCamera — a camera at `position` looking at
 * `focalPoint`. Reuses the node camera; the look-at is expressed as an Euler
 * rotation (no roll). When `active`, becomes the renderer's point of view.
 *
 * NOTE: the look-at Euler is MVP-approximate (yaw/pitch, no roll); validate the
 * sign convention on-device if precise framing matters.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Vec3 = [number, number, number];
type Props = ViroWebNodeProps & {
    active?: boolean;
    focalPoint?: Vec3;
    projection?: "perspective" | "orthographic";
    orthographicScale?: number;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroOrbitCamera(props: Props): React.JSX.Element;
export {};
