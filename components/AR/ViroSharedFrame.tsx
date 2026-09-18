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

  /**
   * What the source is doing, roughly twice a second while it works.
   *
   * Worth rendering: a cloud anchor resolve is multi-frame SIFT over a 30 second
   * window, and without this the app shows nothing at all until it ends.
   * `attempt` counts from 1 and rises when a recoverable failure is retried.
   */
  onLocalizeProgress?: (status: { message: string; attempt: number }) => void;

  /**
   * How many times to re-run a source that failed for a recoverable reason.
   *
   * Defaults to 3, one second apart. Only a failed localisation is retried: a missing anchor, an
   * unsupported platform or a rejected key fails the same way every time, so
   * retrying those only delays the error. On phones the default matters, since
   * one 30 second window often ends a metre short of a match.
   */
  maxAttempts?: number;

  /** Rendered only while the frame is not yet established. */
  placeholder?: React.ReactNode;

  children?: React.ReactNode;
};

type State = { frame: ViroSharedFrameValue | null };

/** How often the source is asked what it is doing. */
const PROGRESS_POLL_MS = 500;

/**
 * Pause before re-running a failed source. On Android a resolve issued on the
 * scene's first frame reaches the bridge before the navigator's native view
 * exists; three instant retries would spend every attempt in that same
 * millisecond.
 */
const RETRY_DELAY_MS = 1000;

/**
 * States worth another go. Everything else is a fact about the anchor, the
 * platform or the credentials, and a second attempt returns it unchanged.
 *
 * ErrorResolvingLocalizationNoMatch is the one that earns this feature: it
 * means the 30 second SIFT window closed without two consistent matches, and
 * the next window starts from wherever the user has walked to since.
 * ErrorResourceExhausted is deliberately absent — retrying a rate limit is how
 * it gets worse.
 */
const RETRYABLE: ReadonlySet<string> = new Set([
  "ErrorResolvingLocalizationNoMatch",
  "ErrorNetworkFailure",
  "ErrorHostingServiceUnavailable",
  "ErrorInternal",
  "TaskInProgress",
]);

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
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  private _retryTimer: ReturnType<typeof setTimeout> | undefined;
  private _attempt = 0;

  componentDidMount() {
    this._mounted = true;
    this._acquire();
  }

  componentDidUpdate(prev: ViroSharedFrameProps) {
    if (prev.source.key !== this.props.source.key) {
      this.setState({ frame: null });
      this._attempt = 0;
      this._clearRetry();
      this._acquire();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    this._stopPolling();
    this._clearRetry();
  }

  _clearRetry = () => {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = undefined;
    }
  };

  _stopPolling = () => {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  };

  _startPolling = () => {
    const { source, arSceneNavigator, onLocalizeProgress } = this.props;
    if (!source.progress || !onLocalizeProgress) return;

    this._stopPolling();
    this._pollTimer = setInterval(async () => {
      const requested = source.key;
      const message = await source.progress!({ arSceneNavigator });
      // A poll in flight outlives the acquire that started it, and a stale one
      // would report the previous anchor's progress against the current one.
      if (!this._mounted || requested !== this.props.source.key) return;
      if (message) {
        this.props.onLocalizeProgress?.({ message, attempt: this._attempt });
      }
    }, PROGRESS_POLL_MS);
  };

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
    this._attempt += 1;
    this._startPolling();
    const outcome = await source.acquire({ arSceneNavigator });
    this._stopPolling();

    // Ignore an acquire that landed after unmount, or after the source changed.
    if (!this._mounted || requested !== this.props.source.key) return;

    if (!outcome.success) {
      const attemptsAllowed = this.props.maxAttempts ?? 3;
      const retryable =
        outcome.state === undefined || RETRYABLE.has(outcome.state);
      if (retryable && this._attempt < attemptsAllowed) {
        this.props.onLocalizeProgress?.({
          message: outcome.error,
          attempt: this._attempt,
        });
        this._retryTimer = setTimeout(() => {
          this._retryTimer = undefined;
          if (this._mounted && requested === this.props.source.key) {
            this._acquire();
          }
        }, RETRY_DELAY_MS);
        return;
      }
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
