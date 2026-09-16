/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroSharedFrame
 */
import * as React from "react";
import { ViroCloudAnchorState, ViroLocalizedEvent } from "../Types/ViroEvents";
import { ViroFrameSource, ViroSharedFrameValue } from "./ViroFrameSource";
export type ViroSharedFrameProps = {
    /**
     * Where the frame comes from — `cloudAnchorFrameSource(id)` on phones, a
     * platform source on a headset. See `ViroFrameSource`.
     */
    source: ViroFrameSource;
    /**
     * The navigator handed to your scene. Passed explicitly rather than read from
     * context: `ViroSceneContext` carries camera callbacks only, and a scene can
     * host more than one navigator.
     */
    arSceneNavigator: any;
    /** Fired once the frame is established and children become visible. */
    onLocalized?: (event: ViroLocalizedEvent) => void;
    /** Fired when the frame cannot be established, including unsupported platforms. */
    onLocalizeError?: (error: string, state?: ViroCloudAnchorState) => void;
    /**
     * What the source is doing, roughly twice a second while it works.
     *
     * Worth rendering: a cloud anchor resolve is multi-frame SIFT over a 30 second
     * window, and without this the app shows nothing at all until it ends.
     * `attempt` counts from 1 and rises when a recoverable failure is retried.
     */
    onLocalizeProgress?: (status: {
        message: string;
        attempt: number;
    }) => void;
    /** Rendered only while the frame is not yet established. */
    placeholder?: React.ReactNode;
    children?: React.ReactNode;
};
type State = {
    frame: ViroSharedFrameValue | null;
};
/**
 * Renders its children in a shared coordinate frame.
 *
 * This is the co-location primitive, independent of how the frame was
 * established. Two devices mounting this with the same `source.key` in the same
 * physical space put their children in the same real-world place.
 *
 * Children are positioned by the scene graph, so a child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no per-app coordinate
 * maths, and nothing that depends on where a given session started tracking.
 *
 * `<ViroARCloudAnchor>` is this with the cloud-anchor source pre-selected.
 */
export declare class ViroSharedFrame extends React.Component<ViroSharedFrameProps, State> {
    state: State;
    private static _unsupportedWarned;
    private _mounted;
    private _pollTimer;
    private _attempt;
    componentDidMount(): void;
    componentDidUpdate(prev: ViroSharedFrameProps): void;
    componentWillUnmount(): void;
    _stopPolling: () => void;
    _startPolling: () => void;
    _acquire: () => Promise<void>;
    render(): React.JSX.Element | null;
}
export {};
