/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroVPS
 */

"use strict";

import * as React from "react";
import type { ViroVPSLocalizationResult } from "../Types/ViroEvents";
import {
  findNearestMap,
  getLocationMapDownload,
  fetchMapBytes,
  ViroVPSMapDownload,
} from "./ViroVPSMapDownload";
import { ViroVPSCredentials, ViroVPSUploadError } from "./ViroVPSScanUpload";
import {
  nextTrackingPhase,
  isFreshLocalizedPose,
  VPS_TRACKING_IDLE,
  ViroVPSTrackingPhase,
  ViroVPSTrackingState,
} from "./ViroVPSTracking";

/** Result of a `startTracking()` call — the same shape `loadVPSMap()` resolves with. */
export type ViroVPSStartTrackingResult = {
  success: boolean;
  /** The location actually tracked — the resolved id in `"auto"` mode, or the id passed in. */
  locationId?: string;
  error?: string;
};

export type ViroVPSTrackingStateEvent = {
  state: ViroVPSTrackingState;
  locationId?: string;
  /** Present only when `state` is `"error"`. */
  error?: string;
};

export type ViroVPSLocalizedEvent = {
  locationId: string;
  /**
   * The smoothed T_map_world applied to the current camera pose, as 16
   * comma-separated floats (column-major VROMatrix4f::getArray() order) — the
   * same opaque encoding `getVPSLocalization()` returns it in.
   */
  renderPose: string;
  lastHitInliers?: number;
  lastHitReprojRms?: number;
};

export type ViroVPSProps = {
  /**
   * The navigator handed to your scene by `ViroARSceneNavigator`. Passed
   * explicitly rather than read from context — same convention as
   * `ViroARCloudAnchor`/`ViroSharedFrame`: `ViroSceneContext` carries camera
   * callbacks only, and a scene can host more than one navigator.
   */
  arSceneNavigator: any;

  /** vps-server's base URL, e.g. `"https://vps.example.com"`. */
  endpoint: string;

  /** Project credentials for vps-server — see `ViroVPSCredentials`. */
  credentials: ViroVPSCredentials;

  /**
   * Search radius for `startTracking("auto")`, in meters. Default 200 —
   * matches `findNearbyLocations()`'s own default.
   */
  autoRadiusMeters?: number;

  /**
   * How often to poll `getVPSLocalization()` once a map is loaded, in ms.
   * Default 500 (2 Hz) — frequent enough to notice convergence promptly,
   * far below the 30-60 Hz the native per-frame matching hook itself runs
   * at, and the same order of magnitude as `ViroSharedFrame`'s progress poll.
   */
  pollIntervalMs?: number;

  /**
   * Fires once per new converged pose, at the poll rate above — not once per
   * native AR frame. See the module doc for why this is a poll, not a
   * pushed native event.
   */
  onLocalized?: (event: ViroVPSLocalizedEvent) => void;

  /** Fires once per state transition — not once per poll tick. */
  onTrackingState?: (event: ViroVPSTrackingStateEvent) => void;

  /**
   * Rendered as-is. `<ViroVPS>` holds no transform of its own — it is a
   * data/event source, not a positioned node — so children are passed
   * through unchanged rather than wrapped in a `ViroNode`.
   */
  children?: React.ReactNode;
};

type State = { phase: ViroVPSTrackingPhase };

/**
 * Downloads and loads a VPS map for continuous localisation, and reports
 * tracking state and localised poses as plain callback props.
 *
 * ## Why polling, not a pushed native event
 *
 * The per-frame matching hook behind `getVPSLocalization()` runs every AR
 * frame (30-60 Hz). `onLocalized`/`onTrackingState` only need to fire on a
 * fresh converged pose or an actual state change — far below that rate — and
 * this codebase's existing continuous-result APIs (`getScanStatus()`,
 * `getVPSLocalization()` itself) are already pollable getters rather than
 * push events for exactly that reason: see `ViroVPSLocalizationResult`'s own
 * doc ("a stand-in for an onLocalized event"). Rather than add a third
 * native→JS event path alongside the RCTDirectEventBlock-style props
 * `ViroARScene` already uses for its own `onXxx` callbacks (`onTrackingUpdated`,
 * `onCameraTransformUpdate`, …), this polls `getVPSLocalization()` on a timer
 * here, in JS, and only invokes `onLocalized`/`onTrackingState` when the
 * derived state actually changes (`nextTrackingPhase()` /
 * `isFreshLocalizedPose()` in `ViroVPSTracking.ts`). No native changes.
 *
 * ```tsx
 * const vpsRef = useRef<ViroVPS>(null);
 *
 * <ViroARScene>
 *   <ViroVPS
 *     ref={vpsRef}
 *     arSceneNavigator={props.arSceneNavigator}
 *     endpoint="https://vps.example.com"
 *     credentials={{ projectId, apiKey }}
 *     onTrackingState={(e) => console.log(e.state)}
 *     onLocalized={(e) => applyMapRelativePose(e.renderPose)}
 *   />
 * </ViroARScene>
 *
 * // Explicit location:
 * await vpsRef.current?.startTracking("loc_abc123");
 * // Or nearest one to the device's current geospatial position:
 * await vpsRef.current?.startTracking("auto");
 *
 * vpsRef.current?.stopTracking();
 * ```
 */
export class ViroVPS extends React.Component<ViroVPSProps, State> {
  state: State = { phase: VPS_TRACKING_IDLE };

  // Bumped by every startTracking()/stopTracking() call so a slow async step
  // from a superseded call (e.g. startTracking("auto") immediately followed
  // by startTracking("loc_x")) cannot apply its result after a newer call has
  // already moved on — same guard ViroSharedFrame uses against its own
  // in-flight acquire().
  private _session = 0;
  private _mounted = false;
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  private _locationId: string | undefined;
  private _lastRenderPose: string | undefined;

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    this._stopPolling();
    // Best-effort: drop whatever map this instance loaded so it does not
    // keep matching against stale content after the component is gone. Not
    // guarded by session/mount checks below since nothing here awaits it.
    if (this.state.phase.state !== "idle") {
      this.props.arSceneNavigator?.unloadVPSMap?.();
    }
  }

  private _setPhase(phase: ViroVPSTrackingPhase, locationId: string | undefined, error?: string) {
    const changed = phase.state !== this.state.phase.state;
    this.setState({ phase });
    if (changed) {
      this.props.onTrackingState?.({ state: phase.state, locationId, error });
    }
  }

  private _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private _startPolling(session: number, locationId: string) {
    this._stopPolling();
    const intervalMs = this.props.pollIntervalMs ?? 500;
    this._pollTimer = setInterval(() => this._poll(session, locationId), intervalMs);
  }

  private _poll = async (session: number, locationId: string) => {
    const nav = this.props.arSceneNavigator;
    if (!nav?.getVPSLocalization) return;

    let localization: ViroVPSLocalizationResult;
    try {
      localization = await nav.getVPSLocalization();
    } catch (error) {
      localization = { available: false, error: String(error) };
    }

    // A poll in flight outlives a stopTracking()/startTracking() that ran
    // while it was awaiting the bridge round trip.
    if (!this._mounted || session !== this._session) return;

    const next = nextTrackingPhase(this.state.phase, localization);
    this._setPhase(
      next,
      locationId,
      next.state === "error" ? localization.error ?? "VPS localisation unavailable" : undefined
    );

    if (isFreshLocalizedPose(this._lastRenderPose, localization)) {
      this._lastRenderPose = localization.renderPose;
      this.props.onLocalized?.({
        locationId,
        renderPose: localization.renderPose,
        lastHitInliers: localization.lastHitInliers,
        lastHitReprojRms: localization.lastHitReprojRms,
      });
    }
  };

  /**
   * Downloads and loads a VPS map and starts continuous localisation
   * against it.
   *
   * - A location id downloads and loads that location's map directly.
   * - `"auto"` reads the device's current geospatial position off
   *   `arSceneNavigator.getCameraGeospatialPose()` — the same source
   *   `checkVPSAvailability()`/`createGeospatialAnchor()` already use for a
   *   device position in this codebase — and tracks the nearest location
   *   that has one (`findNearestMap()`).
   *
   * Calling this again (with the same or a different id) replaces whatever
   * was loaded before; it does not need `stopTracking()` first.
   */
  startTracking = async (locationId: string | "auto"): Promise<ViroVPSStartTrackingResult> => {
    const session = ++this._session;
    this._lastRenderPose = undefined;
    this._stopPolling();
    this._setPhase({ state: "searching", everConverged: false }, undefined);

    const nav = this.props.arSceneNavigator;
    if (!nav?.loadVPSMap) {
      return this._fail(session, undefined, "This navigator does not expose loadVPSMap");
    }

    let resolvedId: string;
    let mapDownload: ViroVPSMapDownload;
    try {
      if (locationId === "auto") {
        if (!nav.getCameraGeospatialPose) {
          return this._fail(
            session,
            undefined,
            "This navigator does not expose getCameraGeospatialPose, needed for \"auto\""
          );
        }
        const poseResult = await nav.getCameraGeospatialPose();
        if (session !== this._session) return { success: false, error: "superseded" };
        if (!poseResult?.success || !poseResult.pose) {
          return this._fail(
            session,
            undefined,
            poseResult?.error ?? "Could not get the device's current geospatial position"
          );
        }
        const found = await findNearestMap(
          this.props.endpoint,
          this.props.credentials,
          poseResult.pose.latitude,
          poseResult.pose.longitude,
          this.props.autoRadiusMeters ?? 200
        );
        if (session !== this._session) return { success: false, error: "superseded" };
        if (!found) {
          return this._fail(session, undefined, "No nearby VPS location with an available map");
        }
        resolvedId = found.location.id;
        mapDownload = found.map;
      } else {
        resolvedId = locationId;
        mapDownload = await getLocationMapDownload(
          this.props.endpoint,
          this.props.credentials,
          locationId
        );
      }
    } catch (e) {
      const error = e instanceof ViroVPSUploadError ? e.message : String(e);
      return this._fail(session, undefined, error);
    }
    if (session !== this._session) return { success: false, error: "superseded" };

    let bytes: Uint8Array;
    try {
      bytes = await fetchMapBytes(mapDownload);
    } catch (e) {
      const error = e instanceof ViroVPSUploadError ? e.message : String(e);
      return this._fail(session, resolvedId, error);
    }
    if (session !== this._session) return { success: false, error: "superseded" };

    const loadResult = await nav.loadVPSMap(bytes);
    if (session !== this._session) return { success: false, error: "superseded" };
    if (!loadResult?.success) {
      return this._fail(session, resolvedId, loadResult?.error ?? "loadVPSMap failed");
    }

    this._locationId = resolvedId;
    this._setPhase({ state: "mapLoaded", everConverged: false }, resolvedId);
    this._startPolling(session, resolvedId);
    return { success: true, locationId: resolvedId };
  };

  private _fail(
    session: number,
    locationId: string | undefined,
    error: string
  ): ViroVPSStartTrackingResult {
    if (session === this._session) {
      this._setPhase({ state: "error", everConverged: false }, locationId, error);
    }
    return { success: false, locationId, error };
  }

  /** Unloads the current map and stops polling. Safe to call when nothing is loaded. */
  stopTracking = (): void => {
    this._session += 1;
    this._stopPolling();
    this._lastRenderPose = undefined;
    const locationId = this._locationId;
    this._locationId = undefined;
    this.props.arSceneNavigator?.unloadVPSMap?.();
    if (this.state.phase.state !== "idle") {
      this._setPhase(VPS_TRACKING_IDLE, locationId);
    }
  };

  render() {
    return this.props.children ?? null;
  }
}
