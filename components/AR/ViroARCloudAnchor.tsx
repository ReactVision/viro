/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroARCloudAnchor
 */

"use strict";

import * as React from "react";
import { ViroNode } from "../ViroNode";
import {
  ViroCloudAnchorState,
  ViroLocalizedEvent,
} from "../Types/ViroEvents";

type ResolveResult = {
  success: boolean;
  anchor?: {
    anchorId: string;
    cloudAnchorId?: string;
    state: ViroCloudAnchorState;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
    resolvedTransform?: string;
  };
  error?: string;
  state: ViroCloudAnchorState;
};

type NavigatorLike = {
  resolveCloudAnchor: (cloudAnchorId: string) => Promise<ResolveResult>;
};

export type ViroARCloudAnchorProps = {
  /** Cloud anchor to localise against — from `finishScan()` or `hostCloudAnchor()`. */
  cloudAnchorId: string;

  /**
   * The navigator handed to your scene by `ViroARSceneNavigator`. Passed
   * explicitly rather than read from context: `ViroSceneContext` carries camera
   * callbacks only, and a scene can host more than one navigator.
   */
  arSceneNavigator: NavigatorLike;

  /** Fired once the anchor localises and children become visible. */
  onLocalized?: (event: ViroLocalizedEvent) => void;

  /** Fired when localisation fails or times out. */
  onLocalizeError?: (error: string, state: ViroCloudAnchorState) => void;

  /** Rendered only while unlocalised — a "look around" prompt, typically. */
  placeholder?: React.ReactNode;

  children?: React.ReactNode;
};

type State = {
  anchor: ResolveResult["anchor"] | null;
};

/**
 * Renders its children in a resolved cloud anchor's **location frame**.
 *
 * This is the co-location primitive. Two devices that mount this with the same
 * `cloudAnchorId` in the same physical space put their children in the same
 * real-world place, because both frames are recovered from the same hosted map.
 *
 * Children are positioned by the scene graph, so a child at `[0, 0, -1]` is one
 * metre in front of the frame origin on every device — no per-app coordinate
 * maths, and nothing that depends on where a given session happened to start
 * tracking.
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
 */
export class ViroARCloudAnchor extends React.Component<
  ViroARCloudAnchorProps,
  State
> {
  state: State = { anchor: null };

  // Resolve is async and the component can unmount mid-flight — a resolve keeps
  // retrying every AR frame until it localises or the window expires, so this is
  // a real window, not a theoretical one.
  private _mounted = false;

  componentDidMount() {
    this._mounted = true;
    this._resolve();
  }

  componentDidUpdate(prev: ViroARCloudAnchorProps) {
    if (prev.cloudAnchorId !== this.props.cloudAnchorId) {
      this.setState({ anchor: null });
      this._resolve();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  _resolve = async () => {
    const { cloudAnchorId, arSceneNavigator } = this.props;
    if (!cloudAnchorId || !arSceneNavigator) return;

    const requested = cloudAnchorId;
    let result: ResolveResult;
    try {
      result = await arSceneNavigator.resolveCloudAnchor(cloudAnchorId);
    } catch (e: any) {
      if (this._mounted && requested === this.props.cloudAnchorId) {
        this.props.onLocalizeError?.(
          e?.message ?? String(e),
          "ErrorInternal" as ViroCloudAnchorState
        );
      }
      return;
    }

    // Ignore a resolve that landed after unmount, or after cloudAnchorId moved on.
    if (!this._mounted || requested !== this.props.cloudAnchorId) return;

    if (!result?.success || !result.anchor) {
      this.props.onLocalizeError?.(
        result?.error ?? "Resolve failed",
        result?.state
      );
      return;
    }

    const anchor = result.anchor;
    this.setState({ anchor });

    this.props.onLocalized?.({
      cloudAnchorId: anchor.cloudAnchorId ?? requested,
      position: anchor.position,
      rotation: anchor.rotation,
      scale: anchor.scale,
      transform: anchor.resolvedTransform ?? "",
    });
  };

  render() {
    const { anchor } = this.state;

    if (!anchor) {
      return this.props.placeholder ? <ViroNode>{this.props.placeholder}</ViroNode> : null;
    }

    return (
      <ViroNode
        position={anchor.position}
        rotation={anchor.rotation}
        scale={anchor.scale}
      >
        {this.props.children}
      </ViroNode>
    );
  }
}
