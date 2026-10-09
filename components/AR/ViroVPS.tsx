/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroVPS
 */

"use strict";

import * as React from "react";
import type { ViroVPSLocalizationResult, ViroVPSMapLoadResult } from "../Types/ViroEvents";
import {
  findNearestMap,
  getLocationMapDownload,
  fetchMapBytes,
  ViroVPSMapDownload,
} from "./ViroVPSMapDownload";
import type { ViroVPSCredentials } from "./ViroVPSClient";
import type { ViroARSceneNavigator } from "./ViroARSceneNavigator";
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
   * Passed through unchanged from `getVPSLocalization()`: 16 comma-separated
   * floats, a 4x4 matrix in column-major order (VROMatrix4f::getArray()).
   * The native side computes it as the smoothed map-from-world correction
   * (T_map_world) multiplied by the latest AR camera pose (T_world_cam), so
   * it is the camera's pose expressed in the map's frame. See the
   * `<ViroVPS>` doc below.
   */
  renderPose: string;
  lastHitInliers?: number;
  lastHitReprojRms?: number;
};

/**
 * The slice of the `arSceneNavigator` object (what `ViroARSceneNavigator`
 * hands your scene) that `<ViroVPS>` calls. Every member is optional so a
 * navigator without VPS support is reported as an error rather than a crash.
 */
export type ViroVPSNavigator = Partial<
  Pick<
    ViroARSceneNavigator["arSceneNavigator"],
    "loadVPSMap" | "unloadVPSMap" | "getVPSLocalization" | "getCameraGeospatialPose"
  >
>;

export type ViroVPSProps = {
  /**
   * The navigator handed to your scene by `ViroARSceneNavigator`. Passed
   * explicitly rather than read from context, same convention as
   * `ViroARCloudAnchor`/`ViroSharedFrame`: `ViroSceneContext` carries camera
   * callbacks only, and a scene can host more than one navigator.
   */
  arSceneNavigator: ViroVPSNavigator;

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
   * How long `startTracking()` waits for the native map load before giving
   * up with state `error`, in ms. Default 30000. A load that lands after
   * the timeout is unloaded again.
   */
  loadTimeoutMs?: number;

  /**
   * How long one `getVPSLocalization()` poll may take before the state
   * moves to `error`, in ms. Default 5000. No new poll starts while one is
   * still pending, so a stuck native call never piles up; the first poll
   * that answers again moves the state back out of `error`.
   */
  localizationTimeoutMs?: number;

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

const SUPERSEDED: ViroVPSStartTrackingResult = { success: false, error: "superseded" };

type Timed<T> = { timedOut: false; value: T } | { timedOut: true };

/** Races `promise` against a timer; the timer is cleared either way. Rejections pass through. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<Timed<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ timedOut: true }), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve({ timedOut: false, value });
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Downloads and loads a VPS map for continuous localisation, and reports
 * tracking state and localised poses as plain callback props.
 *
 * ## Requirements
 *
 * - A ReactVision provider configured on the navigator (otherwise every poll
 *   reports `available: false` and the state goes to `error`).
 * - `startTracking("auto")` reads the device position from
 *   `arSceneNavigator.getCameraGeospatialPose()`, so geospatial tracking
 *   must be enabled on the navigator and producing a pose: ARCore
 *   Geospatial, or on iOS the ReactVision geospatial provider (ARKit plus
 *   the device's GPS fix). Without a geospatial pose, "auto" fails with
 *   state `error`; pass an explicit location id instead.
 *
 * ## What `renderPose` is
 *
 * `onLocalized`'s `renderPose` is what the native side's
 * `rvGetVPSLocalizationJson()` reports, unchanged: 16 comma-separated floats,
 * a 4x4 matrix in column-major order (VROMatrix4f::getArray()). It is the
 * smoothed map-from-world correction (T_map_world) multiplied by the latest
 * AR camera pose (T_world_cam) the native matcher saw, i.e. the camera's
 * current pose in the map's frame. It is only reported once the estimate has
 * converged (state `tracking`).
 *
 * ## Why polling, not a pushed native event
 *
 * The per-frame matching hook behind `getVPSLocalization()` runs every AR
 * frame (30-60 Hz). `onLocalized`/`onTrackingState` only need to fire on a
 * fresh converged pose or an actual state change, far below that rate, and
 * this codebase's existing continuous-result APIs (`getScanStatus()`,
 * `getVPSLocalization()` itself) are already pollable getters rather than
 * push events for exactly that reason. So this polls `getVPSLocalization()`
 * on a timer, in JS, and only invokes `onLocalized`/`onTrackingState` when
 * the derived state actually changes (`nextTrackingPhase()` /
 * `isFreshLocalizedPose()` in `ViroVPSTracking.ts`).
 *
 * ## Lifecycle
 *
 * Unmounting stops polling and unloads the map this component loaded. A map
 * load still in flight when `stopTracking()`, a newer `startTracking()` or
 * unmount supersedes it is unloaded when it lands, unless a newer call has
 * loaded its own map by then. No callback fires after unmount.
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

  // Bumped by every startTracking()/stopTracking() call and by unmount, so a
  // slow async step from a superseded call (e.g. startTracking("auto")
  // immediately followed by startTracking("loc_x")) cannot apply its result
  // after a newer call has already moved on.
  private _session = 0;
  private _mounted = false;
  private _pollTimer: ReturnType<typeof setInterval> | undefined;
  // True while a getVPSLocalization() call is pending; ticks skip until it settles.
  private _pollInFlight = false;
  private _locationId: string | undefined;
  private _lastRenderPose: string | undefined;
  // The session whose map is loaded natively, if this component loaded one
  // and has not unloaded it since.
  private _loadedSession: number | undefined;
  // Source of truth for transitions; this.state may lag behind a batched setState.
  private _phase: ViroVPSTrackingPhase = VPS_TRACKING_IDLE;
  private _lastError: string | undefined;

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    this._session += 1;
    this._stopPolling();
    if (this._loadedSession !== undefined) {
      this._loadedSession = undefined;
      this._unloadNative();
    }
  }

  private _unloadNative() {
    try {
      this.props.arSceneNavigator?.unloadVPSMap?.();
    } catch {
      // The navigator may already be unmounted; nothing left to unload then.
    }
  }

  /**
   * A load that resolved for a session that is no longer current (or after
   * its timeout): drop it, unless a newer session has loaded its own map.
   */
  private _dropOrphanLoad() {
    if (this._loadedSession === undefined) {
      this._unloadNative();
    }
  }

  private _setPhase(phase: ViroVPSTrackingPhase, locationId: string | undefined, error?: string) {
    if (!this._mounted) return;
    const changed =
      phase.state !== this._phase.state || (phase.state === "error" && error !== this._lastError);
    this._phase = phase;
    this._lastError = phase.state === "error" ? error : undefined;
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
    this._pollTimer = setInterval(() => {
      void this._poll(session, locationId);
    }, intervalMs);
  }

  private _poll = async (session: number, locationId: string) => {
    if (this._pollInFlight) return;
    const nav = this.props.arSceneNavigator;
    if (!nav?.getVPSLocalization) return;

    const timeoutMs = this.props.localizationTimeoutMs ?? 5000;
    let call: Promise<ViroVPSLocalizationResult>;
    try {
      call = Promise.resolve(nav.getVPSLocalization());
    } catch (error) {
      call = Promise.reject(error);
    }
    this._pollInFlight = true;
    // Cleared when the native call itself settles, not when the timeout
    // fires, so a stuck call blocks further ticks instead of stacking more.
    call.then(
      () => {
        this._pollInFlight = false;
      },
      () => {
        this._pollInFlight = false;
      }
    );

    let localization: ViroVPSLocalizationResult;
    try {
      const timed = await withTimeout(call, timeoutMs);
      localization = timed.timedOut
        ? { available: false, error: `getVPSLocalization did not answer within ${timeoutMs} ms` }
        : timed.value;
    } catch (error) {
      localization = { available: false, error: errorMessage(error) };
    }

    // A poll in flight outlives a stopTracking()/startTracking()/unmount
    // that ran while it was awaiting the bridge round trip.
    if (!this._mounted || session !== this._session) return;

    const next = nextTrackingPhase(this._phase, localization);
    this._setPhase(
      next,
      locationId,
      next.state === "error" ? localization.error ?? "VPS localisation unavailable" : undefined
    );

    if (next.state === "idle") {
      // The native side reports no map loaded: nothing left to poll for.
      this._stopPolling();
      this._locationId = undefined;
      this._loadedSession = undefined;
      this._lastRenderPose = undefined;
      return;
    }

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
   *   `arSceneNavigator.getCameraGeospatialPose()` (see Requirements above)
   *   and tracks the nearest location that has a map (`findNearestMap()`).
   *
   * Calling this again (with the same or a different id) replaces whatever
   * was loaded before; it does not need `stopTracking()` first.
   */
  startTracking = async (locationId: string | "auto"): Promise<ViroVPSStartTrackingResult> => {
    const session = ++this._session;
    this._lastRenderPose = undefined;
    this._locationId = undefined;
    this._stopPolling();
    if (this._loadedSession !== undefined) {
      // Stop matching against the previous map while the next one downloads.
      this._loadedSession = undefined;
      this._unloadNative();
    }
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
        if (session !== this._session) return SUPERSEDED;
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
        if (session !== this._session) return SUPERSEDED;
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
      return this._fail(session, undefined, errorMessage(e));
    }
    if (session !== this._session) return SUPERSEDED;

    let bytes: Uint8Array;
    try {
      bytes = await fetchMapBytes(mapDownload);
    } catch (e) {
      return this._fail(session, resolvedId, errorMessage(e));
    }
    if (session !== this._session) return SUPERSEDED;

    const loadTimeoutMs = this.props.loadTimeoutMs ?? 30000;
    let loadCall: Promise<ViroVPSMapLoadResult>;
    try {
      loadCall = Promise.resolve(nav.loadVPSMap(bytes));
    } catch (e) {
      loadCall = Promise.reject(e);
    }

    let loadResult: ViroVPSMapLoadResult;
    try {
      const timed = await withTimeout(loadCall, loadTimeoutMs);
      if (timed.timedOut) {
        // The native load may still land later; drop it if it does.
        loadCall.then(
          (late) => {
            if (late?.success) this._dropOrphanLoad();
          },
          () => {}
        );
        return this._fail(
          session,
          resolvedId,
          `loadVPSMap did not answer within ${loadTimeoutMs} ms`
        );
      }
      loadResult = timed.value;
    } catch (e) {
      return this._fail(session, resolvedId, errorMessage(e));
    }

    if (!this._mounted || session !== this._session) {
      if (loadResult?.success) this._dropOrphanLoad();
      return SUPERSEDED;
    }
    if (!loadResult?.success) {
      return this._fail(session, resolvedId, loadResult?.error ?? "loadVPSMap failed");
    }

    this._loadedSession = session;
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
    this._loadedSession = undefined;
    this._unloadNative();
    if (this._phase.state !== "idle") {
      this._setPhase(VPS_TRACKING_IDLE, locationId);
    }
  };

  render() {
    return this.props.children ?? null;
  }
}
