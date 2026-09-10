/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroARCloudAnchor
 */
import * as React from "react";
import { ViroCloudAnchorState, ViroLocalizedEvent } from "../Types/ViroEvents";
export type ViroARCloudAnchorProps = {
    /** Cloud anchor to localise against — from `finishScan()` or `hostCloudAnchor()`. */
    cloudAnchorId: string;
    /**
     * The navigator handed to your scene by `ViroARSceneNavigator`. Passed
     * explicitly rather than read from context: `ViroSceneContext` carries camera
     * callbacks only, and a scene can host more than one navigator.
     */
    arSceneNavigator: any;
    /** Fired once the anchor localises and children become visible. */
    onLocalized?: (event: ViroLocalizedEvent) => void;
    /** Fired when localisation fails, times out, or the platform has no cloud anchors. */
    onLocalizeError?: (error: string, state?: ViroCloudAnchorState) => void;
    /** Rendered only while unlocalised — a "look around" prompt, typically. */
    placeholder?: React.ReactNode;
    children?: React.ReactNode;
};
/**
 * Renders its children in a resolved cloud anchor's location frame.
 *
 * Two devices that mount this with the same `cloudAnchorId` in the same
 * physical space put their children in the same real-world place, because both
 * frames are recovered from the same hosted map. A child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no coordinate maths in
 * app code.
 *
 * ```tsx
 * <ViroARCloudAnchor
 *   cloudAnchorId={id}
 *   arSceneNavigator={props.arSceneNavigator}
 *   onLocalized={(e) => setFrame(e.transform)}
 * >
 *   <ViroBox position={[0, 0, -1]} scale={[0.2, 0.2, 0.2]} />
 * </ViroARCloudAnchor>
 * ```
 *
 * This is `<ViroSharedFrame>` with the cloud-anchor source pre-selected. On a
 * headset, use the platform's own source instead — cloud anchors are
 * unsupported there and this reports `ErrorNotSupported` rather than failing
 * slowly. See `ViroFrameSource`.
 */
export declare class ViroARCloudAnchor extends React.Component<ViroARCloudAnchorProps> {
    private _source;
    private _sourceId;
    private get source();
    render(): React.JSX.Element;
}
