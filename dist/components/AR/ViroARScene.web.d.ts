/**
 * Web implementation of ViroARScene. Renders its children under the scene root
 * (provided by ViroARSceneNavigator.web) and bridges the AR session's plane
 * stream + tracking state to the declarative callbacks:
 *   - onTrackingUpdated       when the tracking state changes
 *   - onAnchorFound/Updated/Removed  as slam planes appear/move/disappear
 *
 * It also provides a claim registry so multiple auto-matching <ViroARPlane>s
 * don't bind to the same detected plane, and exposes performARHitTestWithPoint
 * via ref (ray-vs-plane in the session).
 *
 * MVP scope: plane anchors only (slam has no image/object anchors).
 */
import * as React from "react";
import { type ArPlaneAnchor, type ArHitResult } from "@reactvision/viro-web-renderer";
/** The declarative anchor shape passed to onAnchor* (mirrors ViroAnchor). */
export type ViroWebAnchor = {
    anchorId: string;
    type: "plane";
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    center: [number, number, number];
    width: number;
    height: number;
    alignment: ArPlaneAnchor["alignment"];
};
type Props = {
    onTrackingUpdated?: (state: number, reason: number) => void;
    onAnchorFound?: (anchor: ViroWebAnchor) => void;
    onAnchorUpdated?: (anchor: ViroWebAnchor) => void;
    onAnchorRemoved?: (anchor: ViroWebAnchor) => void;
    children?: React.ReactNode;
    [key: string]: any;
};
export type ViroARSceneHandle = {
    /** Ray-vs-plane hit test from a screen point (device pixels, top-left origin). */
    performARHitTestWithPoint: (x: number, y: number) => Promise<ArHitResult[]>;
};
export declare function anchorToViro(p: ArPlaneAnchor): ViroWebAnchor;
export declare const ViroARScene: React.ForwardRefExoticComponent<Omit<Props, "ref"> & React.RefAttributes<ViroARSceneHandle>>;
export {};
