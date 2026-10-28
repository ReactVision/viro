/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroVPS
 */

"use strict";

import * as React from "react";
import type { ViroVPSLocalizationResult, ViroVPSMapLoadResult } from "../Types/ViroEvents";
import {
  fetchAssetBytes,
  fetchLocationSemanticObjects,
  findNearestMap,
  getLocationMapDownload,
  getLocationWorldMeshDownload,
  fetchMapBytes,
  ViroVPSMapDownload,
  ViroVPSSemanticObject,
} from "./ViroVPSMapDownload";
import {
  localiseFrameOnServer,
  nearFromRenderPose,
  pickVisualCandidate,
  queryLocationsByImage,
} from "./ViroVPSQuery";
import { ViroVPSError } from "./ViroVPSClient";
import type { ViroVPSConnection, ViroVPSCredentialsSource } from "./ViroVPSClient";
import type { ViroARSceneNavigator } from "./ViroARSceneNavigator";
import {
  nextTrackingPhase,
  isFreshLocalizedPose,
  VPS_TRACKING_IDLE,
  ViroVPSTrackingPhase,
  ViroVPSTrackingState,
} from "./ViroVPSTracking";

/**
 * Why a VPS step failed. `code` is the server's own `error.code` when the
 * failure is its answer (such as `NO_ASSET` for a location with no map yet,
 * `PAID_PLAN_REQUIRED` or `mfa_required`), `HTTP_ERROR` for an error answer
 * without one, or one of these, set on the device:
 *
 * - `NETWORK_ERROR`: a request got no response.
 * - `CREDENTIALS_UNAVAILABLE`: the `credentials` function threw or rejected,
 *   or there were none to default to.
 * - `VPS_SERVER_NOT_CONFIGURED`: server mode or image search, and Studio gave
 *   out no VPS server address.
 * - `INVALID_APP_USER_ID`: `appUserId` breaks the rule in `ViroVPSCredentials.appUserId`.
 * - `UNSUPPORTED`: the navigator cannot do it; the state is `unsupported`.
 * - `NO_LOCATION`: `"auto"` or `"visual"` found no location with a map.
 * - `MAP_LOAD_FAILED`: the native map load failed or did not answer.
 * - `LOCALIZATION_UNAVAILABLE`: a localisation poll failed or did not answer.
 * - `SUPERSEDED`: a newer `startTracking()`, `stopTracking()` or unmount took over.
 * - `UNKNOWN`: anything else.
 */
export type ViroVPSErrorDetail = {
  code: string;
  /** The HTTP status of the server's answer; null when there was no answer. */
  status: number | null;
  /** The same text as the `error` string beside it. */
  message: string;
};

/** Result of a `startTracking()` call — the same shape `loadVPSMap()` resolves with. */
export type ViroVPSStartTrackingResult = {
  success: boolean;
  /** The location actually tracked — the resolved id in `"auto"` mode, or the id passed in. */
  locationId?: string;
  error?: string;
  /** Present with `error`. */
  errorDetail?: ViroVPSErrorDetail;
};

export type ViroVPSTrackingStateEvent = {
  state: ViroVPSTrackingState;
  locationId?: string;
  /** Present only when `state` is `"error"` or `"unsupported"`. */
  error?: string;
  /** Present with `error`. */
  errorDetail?: ViroVPSErrorDetail;
};

export type ViroVPSWorldMeshEvent = {
  locationId: string;
  /** True once the mesh is loaded; it appears when localisation converges. */
  success: boolean;
  /** True when the location's active scan has no mesh (a map-only scan). Not an error. */
  missing?: boolean;
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
    | "loadVPSMap"
    | "unloadVPSMap"
    | "loadVPSMapMesh"
    | "unloadVPSMapMesh"
    | "captureVPSQueryFrame"
    | "startVPSServerSession"
    | "reportVPSServerFix"
    | "getVPSLocalization"
    | "getCameraGeospatialPose"
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

  /**
   * Studio's address, which serves the location lookups and map downloads.
   * Default: the Studio session's, else `https://platform.reactvision.xyz`.
   */
  endpoint?: string;

  /**
   * The VPS server's address, for server mode and image search. Default: the
   * one Studio gives out.
   */
  serverEndpoint?: string;

  /**
   * Project credentials (see `ViroVPSCredentials`), or a function returning
   * them. A function is called before every request (each location lookup,
   * image query and map download), so a short-lived token the host refreshes
   * is used without a re-render. For a user token from the app's backend,
   * pass createUserTokenCredentials(), which keeps the token between requests.
   * Default: the Studio session, or the `rvApiKey` and `rvProjectId` set in
   * viro's Expo plugin.
   */
  credentials?: ViroVPSCredentialsSource;

  /**
   * The app's own id for its signed-in user, sent as `x-app-user-id` on every
   * VPS request; see `ViroVPSCredentials.appUserId`. Replaces one given in
   * `credentials`.
   */
  appUserId?: string;

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
   * Also load the location's mesh (the backend's `world_mesh`) once its map
   * is loaded, for occlusion and/or physics against the real place: content
   * hides behind real walls and furniture, and physics bodies collide with
   * them, on any device, no depth sensor needed. The mesh appears when
   * localisation converges and follows the map's corrections from then on.
   * `true` means both; pass an object to choose. Off by default: it is a
   * few MB more to download. A failure here never fails tracking; see
   * `onWorldMesh`.
   */
  worldMesh?: boolean | { occlusion?: boolean; physics?: boolean };

  /** How the `worldMesh` load went, once per tracked location. */
  onWorldMesh?: (event: ViroVPSWorldMeshEvent) => void;

  /**
   * Whether `startTracking("auto")` may find the location from the camera
   * image when GPS cannot: no geospatial pose, or no location with a map
   * nearby (indoors). Default true. `startTracking("visual")` always does.
   */
  visualSearch?: boolean;

  /**
   * How long the visual search keeps trying, in ms, before the state moves to
   * `error`. Default 30000. Each attempt sends one camera image; a view the
   * maps do not cover (a blank wall) simply fails and is retried.
   */
  visualSearchTimeoutMs?: number;

  /** Pause between visual search attempts, in ms. Default 3000. */
  visualSearchIntervalMs?: number;

  /**
   * Where localisation runs.
   *
   * - `"device"` (default): the location's map is downloaded and the device
   *   matches the camera against it (SIFT), as before.
   * - `"server"`: no map is downloaded. The device sends a camera frame every
   *   `serverFixIntervalMs` to the VPS server (`POST /vps/locations/{id}/localise`),
   *   which matches it with DISK + LightGlue and answers with the pose; the same
   *   fuser turns those answers into tracking, and ARKit / ARCore carry the pose
   *   between them. It holds up across days, lighting and moved objects where
   *   SIFT does not, at the cost of a network round trip per fix. The location's
   *   map must have been built with server mode on (the VPS server's
   *   `VPS_SERVER_MAPS`); otherwise the state goes to `error` with code
   *   `NO_SERVER_MAP`. It needs a paid plan and is billed as Advanced VPS
   *   compute time, per second the server spends on each frame. A refusal
   *   (401 or 403, such as `PAID_PLAN_REQUIRED` or
   *   `COMPUTE_SPEND_LIMIT_REACHED`) ends tracking with its code, unless it
   *   refused a user token and `credentials` give a new one, which the frame
   *   is sent again with; no answer, 429 and 5xx are retried with the next
   *   frame.
   */
  localization?: "device" | "server";

  /** Server mode: ms between frames sent until localisation converges. Default 1000. */
  serverFixIntervalMs?: number;

  /** Server mode: ms between frames once converged, to keep correcting drift. Default 10000. */
  serverRefreshIntervalMs?: number;

  /**
   * Rendered as-is. `<ViroVPS>` holds no transform of its own — it is a
   * data/event source, not a positioned node — so children are passed
   * through unchanged rather than wrapped in a `ViroNode`.
   */
  children?: React.ReactNode;
};

type State = { phase: ViroVPSTrackingPhase };

const SUPERSEDED: ViroVPSStartTrackingResult = {
  success: false,
  error: "superseded",
  errorDetail: { code: "SUPERSEDED", status: null, message: "superseded" },
};
const SUPERSEDED_SEARCH = Symbol("superseded");

type FoundLocation = { locationId: string; map: ViroVPSMapDownload };

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

function localError(code: string, message: string): ViroVPSErrorDetail {
  return { code, status: null, message };
}

function toErrorDetail(e: unknown): ViroVPSErrorDetail {
  if (e instanceof ViroVPSError) {
    return {
      code: e.code ?? (e.status !== undefined ? "HTTP_ERROR" : "UNKNOWN"),
      status: e.status ?? null,
      message: e.message,
    };
  }
  return localError("UNKNOWN", errorMessage(e));
}

// A navigator holds one map and one mesh, shared by every <ViroVPS> on it
// (a covered scene's and the one on screen). Each load takes the next number
// for its slot, and a slot is unloaded only on behalf of its newest load, so
// a late load from a covered scene never unloads the newer scene's map. The
// native load and unload take the same number. Natively, a load is not
// applied when another load, or an unload that runs, was called after it, and
// an unload naming a replaced load does nothing, whatever order the native
// side finishes them in.
type NavigatorLoads = { map: number; mesh: number };
const navigatorLoads = new WeakMap<object, NavigatorLoads>();

function newestLoad(nav: object, slot: keyof NavigatorLoads): number {
  return navigatorLoads.get(nav)?.[slot] ?? 0;
}

function startLoad(nav: object, slot: keyof NavigatorLoads): number {
  const loads = navigatorLoads.get(nav) ?? { map: 0, mesh: 0 };
  navigatorLoads.set(nav, loads);
  return ++loads[slot];
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
 *   the device's GPS fix). Without a geospatial pose, or with no location
 *   nearby, it falls back to the visual search below (`visualSearch`).
 *
 * ## Finding a place without GPS
 *
 * `startTracking("visual")`, and `"auto"` when GPS gives nothing, send camera
 * images to the VPS server (`POST /vps/locations/query`), which finds the
 * project's location whose map the image localises against. It retries
 * every `visualSearchIntervalMs` for up to `visualSearchTimeoutMs`, so point
 * the camera at the scanned place, not a blank wall.
 *
 * ## Placing content
 *
 * Put content in the map's frame inside `<ViroVPSAnchor>`: it follows the
 * same correction as the location's mesh, every frame, and stays hidden
 * until tracking converges. `getSemanticObjects()` gives the objects found
 * in the scan, in that frame.
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
 * ## The location's mesh
 *
 * With `worldMesh`, the location's mesh is loaded after its map, for
 * occlusion and physics. It needs no `worldMeshEnabled` and no depth sensor,
 * stays hidden until localisation converges, and moves with every
 * correction of the map's placement. Reported through `onWorldMesh`.
 *
 * ## Lifecycle
 *
 * Unmounting stops polling and unloads the map this component loaded. A map
 * load still in flight when `stopTracking()`, a newer `startTracking()` or
 * unmount supersedes it is unloaded when it lands, unless a newer load has
 * started on the same navigator by then, from this `<ViroVPS>` or another
 * one: the navigator holds one map, and the newest load owns it. The mesh
 * works the same way. No callback fires after unmount.
 *
 * ## One tracking `<ViroVPS>` per navigator
 *
 * Several `<ViroVPS>` may sit on one navigator, but only one may track at a
 * time; two tracking at once is not supported. A second `startTracking()`
 * takes the navigator's map without telling the first component, which then
 * reports poses from the second location's map under its own location id
 * (server mode included), and goes idle when the second stops. Stop or
 * unmount the first before starting another; one after the other works.
 *
 * ```tsx
 * const vpsRef = useRef<ViroVPS>(null);
 *
 * <ViroARScene>
 *   <ViroVPS
 *     ref={vpsRef}
 *     arSceneNavigator={props.arSceneNavigator}
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
  // This component's newest map load on the navigator (see startLoad); 0 before its first.
  private _mapLoad = 0;
  // Source of truth for transitions; this.state may lag behind a batched setState.
  private _phase: ViroVPSTrackingPhase = VPS_TRACKING_IDLE;
  private _lastError: string | undefined;

  private _connection = (): ViroVPSConnection => ({
    endpoint: this.props.endpoint,
    serverEndpoint: this.props.serverEndpoint,
    credentials: this.props.credentials,
    appUserId: this.props.appUserId,
  });

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

  /** Unloads the map and mesh, unless a load started after `mapLoad` owns them now. */
  private _unloadNative(mapLoad = this._mapLoad) {
    const nav = this.props.arSceneNavigator;
    if (!nav || newestLoad(nav, "map") !== mapLoad) return;
    try {
      nav.unloadVPSMap?.(mapLoad);
      nav.unloadVPSMapMesh?.(newestLoad(nav, "mesh"));
    } catch {
      // The navigator may already be unmounted; nothing left to unload then.
    }
  }

  /**
   * Downloads and loads the location's mesh after its map, when the
   * `worldMesh` prop asks for it. Best effort: tracking does not wait for it
   * and does not fail with it.
   */
  private async _loadWorldMesh(session: number, locationId: string) {
    const option = this.props.worldMesh;
    const nav = this.props.arSceneNavigator;
    if (!option || !nav?.loadVPSMapMesh) return;
    const occlusion = option === true ? true : option.occlusion ?? true;
    const physics = option === true ? true : option.physics ?? true;
    if (!occlusion && !physics) return;

    const report = (event: ViroVPSWorldMeshEvent) => {
      if (this._mounted && session === this._session) this.props.onWorldMesh?.(event);
    };
    try {
      const download = await getLocationWorldMeshDownload(locationId, this._connection());
      if (session !== this._session) return;
      const bytes = await fetchAssetBytes(download);
      if (session !== this._session) return;
      const meshLoad = startLoad(nav, "mesh");
      const result = await nav.loadVPSMapMesh(bytes, { occlusion, physics }, meshLoad);
      if (session !== this._session) {
        // Superseded while loading: a mesh load started since owns the slot.
        if (result?.success && newestLoad(nav, "mesh") === meshLoad) {
          nav.unloadVPSMapMesh?.(meshLoad);
        }
        return;
      }
      report({ locationId, success: !!result?.success, error: result?.error });
    } catch (e) {
      if (e instanceof ViroVPSError && e.status === 404) {
        report({ locationId, success: false, missing: true });
      } else {
        report({ locationId, success: false, error: errorMessage(e) });
      }
    }
  }

  private _setPhase(
    phase: ViroVPSTrackingPhase,
    locationId: string | undefined,
    errorDetail?: ViroVPSErrorDetail
  ) {
    if (!this._mounted) return;
    const error = errorDetail?.message;
    const changed =
      phase.state !== this._phase.state || (phase.state === "error" && error !== this._lastError);
    this._phase = phase;
    this._lastError = phase.state === "error" ? error : undefined;
    this.setState({ phase });
    if (changed) {
      this.props.onTrackingState?.({ state: phase.state, locationId, error, errorDetail });
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
      next.state === "error"
        ? localError(
            "LOCALIZATION_UNAVAILABLE",
            localization.error ?? "VPS localisation unavailable"
          )
        : undefined
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
   *   Without a pose or a nearby location it falls back to `"visual"`,
   *   unless `visualSearch` is false.
   * - `"visual"` finds the location from camera images (no GPS needed).
   *
   * Calling this again (with the same or a different id) replaces whatever
   * was loaded before; it does not need `stopTracking()` first.
   */
  startTracking = async (
    locationId: string | "auto" | "visual"
  ): Promise<ViroVPSStartTrackingResult> => {
    const session = ++this._session;
    this._lastRenderPose = undefined;
    this._locationId = undefined;
    this._stopPolling();
    if (this._loadedSession !== undefined) {
      // Stop matching against the previous map while the next one downloads.
      this._loadedSession = undefined;
      this._unloadNative();
    }
    const nav = this.props.arSceneNavigator;
    const server = this.props.localization === "server";
    if (
      server
        ? !nav?.startVPSServerSession || !nav.reportVPSServerFix || !nav.captureVPSQueryFrame
        : !nav?.loadVPSMap
    ) {
      return this._fail(
        session,
        undefined,
        localError(
          "UNSUPPORTED",
          server
            ? "This navigator does not expose server-mode VPS (startVPSServerSession)"
            : "This navigator does not expose loadVPSMap"
        )
      );
    }
    this._setPhase({ state: "searching", everConverged: false }, undefined);

    let resolvedId: string;
    let mapDownload: ViroVPSMapDownload | undefined;
    try {
      if (locationId === "auto" || locationId === "visual") {
        const found = await this._findLocation(session, locationId);
        if (found === SUPERSEDED_SEARCH) return SUPERSEDED;
        if ("error" in found) return this._fail(session, undefined, found.error);
        resolvedId = found.locationId;
        mapDownload = found.map;
      } else {
        resolvedId = locationId;
        // server mode needs no map on the device
        mapDownload = server
          ? undefined
          : await getLocationMapDownload(locationId, this._connection());
      }
    } catch (e) {
      return this._fail(session, undefined, toErrorDetail(e));
    }
    if (session !== this._session) return SUPERSEDED;
    if (server) return this._startServerSession(session, resolvedId);
    if (!mapDownload) {
      return this._fail(session, resolvedId, localError("UNKNOWN", "No map to download"));
    }

    let bytes: Uint8Array;
    try {
      bytes = await fetchMapBytes(mapDownload);
    } catch (e) {
      return this._fail(session, resolvedId, toErrorDetail(e));
    }
    if (session !== this._session) return SUPERSEDED;

    const loadTimeoutMs = this.props.loadTimeoutMs ?? 30000;
    const mapLoad = startLoad(nav, "map");
    this._mapLoad = mapLoad;
    // For a load nothing wants any more: superseded, timed out or failed. A
    // failed one counts because an older load that landed meanwhile was kept
    // for it.
    const dropLoad = () => this._unloadNative(mapLoad);
    let loadCall: Promise<ViroVPSMapLoadResult>;
    try {
      loadCall = Promise.resolve(nav.loadVPSMap!(bytes, mapLoad));
    } catch (e) {
      loadCall = Promise.reject(e);
    }

    let loadResult: ViroVPSMapLoadResult;
    try {
      const timed = await withTimeout(loadCall, loadTimeoutMs);
      if (timed.timedOut) {
        // The native load may still land later; drop it when it settles.
        loadCall.then(dropLoad, dropLoad);
        return this._fail(
          session,
          resolvedId,
          localError("MAP_LOAD_FAILED", `loadVPSMap did not answer within ${loadTimeoutMs} ms`)
        );
      }
      loadResult = timed.value;
    } catch (e) {
      dropLoad();
      return this._fail(session, resolvedId, localError("MAP_LOAD_FAILED", errorMessage(e)));
    }

    const superseded = !this._mounted || session !== this._session;
    if (superseded || !loadResult?.success) dropLoad();
    if (superseded) return SUPERSEDED;
    if (!loadResult?.success) {
      return this._fail(
        session,
        resolvedId,
        localError("MAP_LOAD_FAILED", loadResult?.error ?? "loadVPSMap failed")
      );
    }

    this._loadedSession = session;
    this._locationId = resolvedId;
    this._setPhase({ state: "mapLoaded", everConverged: false }, resolvedId);
    this._startPolling(session, resolvedId);
    void this._loadWorldMesh(session, resolvedId);
    return { success: true, locationId: resolvedId };
  };

  /**
   * Server mode's half of startTracking(): the native fuser starts without a
   * map (taking the map slot, so it is numbered and unloaded like a map), and
   * frames go to the backend until the component stops tracking.
   */
  private async _startServerSession(
    session: number,
    locationId: string
  ): Promise<ViroVPSStartTrackingResult> {
    const nav = this.props.arSceneNavigator;
    const loadTimeoutMs = this.props.loadTimeoutMs ?? 30000;
    const mapLoad = startLoad(nav, "map");
    this._mapLoad = mapLoad;
    const dropLoad = () => this._unloadNative(mapLoad);
    let call: Promise<ViroVPSMapLoadResult>;
    try {
      call = Promise.resolve(nav.startVPSServerSession!(mapLoad));
    } catch (e) {
      call = Promise.reject(e);
    }
    let result: ViroVPSMapLoadResult;
    try {
      const timed = await withTimeout(call, loadTimeoutMs);
      if (timed.timedOut) {
        call.then(dropLoad, dropLoad);
        return this._fail(
          session,
          locationId,
          localError(
            "MAP_LOAD_FAILED",
            `startVPSServerSession did not answer within ${loadTimeoutMs} ms`
          )
        );
      }
      result = timed.value;
    } catch (e) {
      dropLoad();
      return this._fail(session, locationId, localError("MAP_LOAD_FAILED", errorMessage(e)));
    }
    const superseded = !this._mounted || session !== this._session;
    if (superseded || !result?.success) dropLoad();
    if (superseded) return SUPERSEDED;
    if (!result?.success) {
      return this._fail(
        session,
        locationId,
        localError("MAP_LOAD_FAILED", result?.error ?? "startVPSServerSession failed")
      );
    }

    this._loadedSession = session;
    this._locationId = locationId;
    this._setPhase({ state: "mapLoaded", everConverged: false }, locationId);
    this._startPolling(session, locationId);
    void this._serverFixes(session, locationId);
    void this._loadWorldMesh(session, locationId);
    return { success: true, locationId };
  }

  /**
   * Sends frames to the backend while this session lasts: one every
   * `serverFixIntervalMs` until the fuser converges, then one every
   * `serverRefreshIntervalMs`, each with the last pose as a hint. A frame
   * that does not localise, or a network failure, is simply retried; a
   * location without a server map ends tracking with that error.
   */
  private async _serverFixes(session: number, locationId: string) {
    const nav = this.props.arSceneNavigator;
    const live = () => this._mounted && session === this._session && this._loadedSession === session;
    const device = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    while (live()) {
      const converged = this._phase.state === "tracking";
      try {
        const frame = await nav.captureVPSQueryFrame!();
        if (!live()) return;
        if (frame.success) {
          if (!frame.worldFromCamera) {
            this._endServerSession(
              session,
              locationId,
              localError(
                "UNSUPPORTED",
                "This native build does not report the camera pose with captured frames"
              )
            );
            return;
          }
          const fix = await localiseFrameOnServer(
            locationId,
            frame,
            converged ? nearFromRenderPose(this._lastRenderPose) : undefined,
            device,
            this._connection()
          );
          if (!live()) return;
          if (fix.localised && fix.T_map_cam) {
            await nav.reportVPSServerFix!(frame.worldFromCamera, fix.T_map_cam, fix.inliers);
          }
        }
      } catch (e) {
        if (!live()) return;
        const detail = toErrorDetail(e);
        // a refusal the next frame would get too: the map, the credential,
        // the plan, the team's compute billing, or no server to send it to
        if (
          detail.code === "NO_SERVER_MAP" ||
          detail.code === "NOT_FOUND" ||
          detail.code === "VPS_SERVER_NOT_CONFIGURED" ||
          detail.status === 401 ||
          detail.status === 403
        ) {
          this._endServerSession(session, locationId, detail);
          return;
        }
        // anything else (offline, rate limited, the server busy) is retried
      }
      const waitMs = converged
        ? this.props.serverRefreshIntervalMs ?? 10000
        : this.props.serverFixIntervalMs ?? 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private _endServerSession(session: number, locationId: string, detail: ViroVPSErrorDetail) {
    this._stopPolling();
    this._loadedSession = undefined;
    this._unloadNative();
    this._fail(session, locationId, detail);
  }

  /**
   * The location for `"auto"` / `"visual"`: GPS first (auto only), then the
   * camera image when GPS gives nothing and the visual search is allowed.
   */
  private async _findLocation(
    session: number,
    mode: "auto" | "visual"
  ): Promise<FoundLocation | { error: ViroVPSErrorDetail } | typeof SUPERSEDED_SEARCH> {
    const nav = this.props.arSceneNavigator;
    const visualAllowed = mode === "visual" || this.props.visualSearch !== false;
    const canSearchVisually = visualAllowed && !!nav.captureVPSQueryFrame;
    let gpsError: ViroVPSErrorDetail;
    let position: { lat: number; lon: number } | undefined;

    if (mode === "auto" && nav.getCameraGeospatialPose) {
      const poseResult = await nav.getCameraGeospatialPose();
      if (session !== this._session) return SUPERSEDED_SEARCH;
      if (poseResult?.success && poseResult.pose) {
        position = { lat: poseResult.pose.latitude, lon: poseResult.pose.longitude };
        const found = await findNearestMap(
          position.lat,
          position.lon,
          this.props.autoRadiusMeters ?? 200,
          this._connection()
        );
        if (session !== this._session) return SUPERSEDED_SEARCH;
        if (found) return { locationId: found.location.id, map: found.map };
        gpsError = localError("NO_LOCATION", "No nearby VPS location with an available map");
      } else {
        gpsError = localError(
          "NO_LOCATION",
          poseResult?.error ?? "Could not get the device's current geospatial position"
        );
      }
    } else if (mode === "auto") {
      gpsError = localError(
        "UNSUPPORTED",
        'This navigator does not expose getCameraGeospatialPose, needed for "auto"'
      );
    } else {
      gpsError = localError(
        "UNSUPPORTED",
        "This navigator does not expose captureVPSQueryFrame, needed for \"visual\""
      );
    }

    if (!canSearchVisually) return { error: gpsError };
    return this._visualSearch(session, position);
  }

  /**
   * Sends camera images to the backend until one localises against a
   * location's map, or the visual search times out.
   */
  private async _visualSearch(
    session: number,
    position: { lat: number; lon: number } | undefined
  ): Promise<FoundLocation | { error: ViroVPSErrorDetail } | typeof SUPERSEDED_SEARCH> {
    const nav = this.props.arSceneNavigator;
    const timeoutMs = this.props.visualSearchTimeoutMs ?? 30000;
    const intervalMs = this.props.visualSearchIntervalMs ?? 3000;
    const deadline = Date.now() + timeoutMs;
    const noMatch = localError("NO_LOCATION", "No VPS location matched the camera view");
    let lastError = noMatch;

    while (true) {
      const frame = await nav.captureVPSQueryFrame!();
      if (session !== this._session) return SUPERSEDED_SEARCH;
      if (frame.success) {
        try {
          const candidates = await queryLocationsByImage(
            frame,
            position ? { lat: position.lat, lon: position.lon, radiusM: 500 } : {},
            this._connection()
          );
          if (session !== this._session) return SUPERSEDED_SEARCH;
          const best = pickVisualCandidate(candidates);
          if (best) {
            const map = await getLocationMapDownload(best.location_id, this._connection());
            if (session !== this._session) return SUPERSEDED_SEARCH;
            return { locationId: best.location_id, map };
          }
          lastError = noMatch;
        } catch (e) {
          if (session !== this._session) return SUPERSEDED_SEARCH;
          lastError = toErrorDetail(e);
        }
      } else {
        lastError = localError("NO_LOCATION", frame.error);
      }
      if (Date.now() + intervalMs > deadline) {
        return { error: lastError };
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      if (session !== this._session) return SUPERSEDED_SEARCH;
    }
  }

  /**
   * The objects found in the tracked location's scan (`semantic.json`), in
   * its map's frame: place content at their positions inside a
   * `<ViroVPSAnchor>`. `[]` when the scan has none, or nothing is tracked.
   */
  getSemanticObjects = async (): Promise<ViroVPSSemanticObject[]> => {
    const locationId = this._locationId;
    if (!locationId) return [];
    return fetchLocationSemanticObjects(locationId, this._connection());
  };

  private _fail(
    session: number,
    locationId: string | undefined,
    errorDetail: ViroVPSErrorDetail
  ): ViroVPSStartTrackingResult {
    if (session === this._session) {
      const state = errorDetail.code === "UNSUPPORTED" ? "unsupported" : "error";
      this._setPhase({ state, everConverged: false }, locationId, errorDetail);
    }
    return { success: false, locationId, error: errorDetail.message, errorDetail };
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
