/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroSharedFrame
 */

"use strict";

import * as React from "react";
import { ViroNode } from "../ViroNode";
import { ViroCloudAnchorState, ViroLocalizedEvent } from "../Types/ViroEvents";
import {
  ViroFrameSource,
  ViroSharedFrameValue,
} from "./ViroFrameSource";

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

  /** Rendered only while the frame is not yet established. */
  placeholder?: React.ReactNode;

  children?: React.ReactNode;
};

type State = { frame: ViroSharedFrameValue | null };

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
export class ViroSharedFrame extends React.Component<ViroSharedFrameProps, State> {
  state: State = { frame: null };

  private static _unsupportedWarned = new Set<string>();

  // Acquiring is async and the component can unmount mid-flight — a cloud
  // anchor resolve retries every AR frame until it localises or the window
  // expires, so this is a real window, not a theoretical one.
  private _mounted = false;

  componentDidMount() {
    this._mounted = true;
    this._acquire();
  }

  componentDidUpdate(prev: ViroSharedFrameProps) {
    if (prev.source.key !== this.props.source.key) {
      this.setState({ frame: null });
      this._acquire();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _acquire = async () => {
    const { source, arSceneNavigator } = this.props;

    if (!source.support.ok) {
      // Warn once per source kind, not per mount: a list of shared objects
      // would otherwise produce one line each.
      if (!ViroSharedFrame._unsupportedWarned.has(source.name)) {
        console.warn(
          `[Viro] ViroSharedFrame: the ${source.name} frame source is not supported on this platform. ${source.support.reason}`
        );
        ViroSharedFrame._unsupportedWarned.add(source.name);
      }
      this.props.onLocalizeError?.(source.support.reason, "ErrorNotSupported");
      return;
    }

    const requested = source.key;
    const outcome = await source.acquire({ arSceneNavigator });

    // Ignore an acquire that landed after unmount, or after the source changed.
    if (!this._mounted || requested !== this.props.source.key) return;

    if (!outcome.success) {
      this.props.onLocalizeError?.(outcome.error, outcome.state);
      return;
    }

    this.setState({ frame: outcome.frame });
    this.props.onLocalized?.({
      cloudAnchorId: requested,
      position: outcome.frame.position,
      rotation: outcome.frame.rotation,
      scale: outcome.frame.scale,
      transform: outcome.frame.transform,
    });
  };

  render() {
    const { frame } = this.state;

    if (!frame) {
      return this.props.placeholder
        ? <ViroNode>{this.props.placeholder}</ViroNode>
        : null;
    }

    return (
      <ViroNode
        position={frame.position}
        rotation={frame.rotation}
        scale={frame.scale}
      >
        {this.props.children}
      </ViroNode>
    );
  }
}
