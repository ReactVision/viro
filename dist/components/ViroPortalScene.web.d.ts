/**
 * Web implementation of ViroPortalScene — a VROPortal node holding the content
 * seen through a portal entrance. Its `<ViroPortal>` child defines the doorway;
 * other children are the content rendered inside the portal.
 *
 * MVP scope: passable + transform + children. `onPortalEnter/Exit` (requires
 * passability/collision events) are follow-ups.
 */
import * as React from "react";
import { type ViroWebNodeProps } from "./Web/useViroNode";
type Props = ViroWebNodeProps & {
    passable?: boolean;
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroPortalScene(props: Props): React.JSX.Element;
export {};
