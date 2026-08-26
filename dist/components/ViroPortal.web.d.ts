/**
 * Web implementation of ViroPortal — the entrance frame (VROPortalFrame) of the
 * enclosing ViroPortalScene. Its children are the doorway geometry (e.g. a
 * Viro3DObject of an arch/door). Registering the entrance parents the frame
 * under the portal scene, so this does not use useViroNode's auto-parenting.
 */
import * as React from "react";
type Props = {
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: [number, number, number];
    children?: React.ReactNode;
    [key: string]: any;
};
export declare function ViroPortal(props: Props): React.JSX.Element;
export {};
