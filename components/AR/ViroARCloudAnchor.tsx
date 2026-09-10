/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroARCloudAnchor
 */

"use strict";

import * as React from "react";
import { ViroCloudAnchorState, ViroLocalizedEvent } from "../Types/ViroEvents";
import { cloudAnchorFrameSource } from "./ViroFrameSource";
import { ViroSharedFrame } from "./ViroSharedFrame";

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
export class ViroARCloudAnchor extends React.Component<ViroARCloudAnchorProps> {
  // Rebuilt only when the id changes: the source is compared by `key`, so a new
  // object every render would restart acquisition on each parent update.
  private _source = cloudAnchorFrameSource(this.props.cloudAnchorId);
  private _sourceId = this.props.cloudAnchorId;

  private get source() {
    if (this._sourceId !== this.props.cloudAnchorId) {
      this._sourceId = this.props.cloudAnchorId;
      this._source = cloudAnchorFrameSource(this.props.cloudAnchorId);
    }
    return this._source;
  }

  render() {
    return (
      <ViroSharedFrame
        source={this.source}
        arSceneNavigator={this.props.arSceneNavigator}
        onLocalized={this.props.onLocalized}
        onLocalizeError={this.props.onLocalizeError}
        placeholder={this.props.placeholder}
      >
        {this.props.children}
      </ViroSharedFrame>
    );
  }
}
