/**
 * Copyright © 2026 ReactVision
 *
 * Pure, native-free state derivation for `<ViroVPS>` (ViroVPS.tsx): turning a
 * polled `ViroVPSLocalizationResult` into the small set of states an app
 * actually cares about.
 *
 * Kept separate from the component so the state machine can be exercised
 * without mounting a React tree, a navigator ref, or the bridge — the same
 * reasoning ViroScanStatus.ts and ViroFrameSource.ts already apply to their
 * own pure pieces.
 */

"use strict";

import type { ViroVPSLocalizationResult } from "../Types/ViroEvents";

/**
 * - `idle`      — no map requested, or stopTracking() has run.
 * - `searching` — startTracking() is resolving a location (auto mode) and/or
 *   downloading and loading its map; no map is loaded yet.
 * - `mapLoaded` — a map is loaded and matching is running, but the smoothed
 *   estimate has not accepted a hit yet.
 * - `tracking`  — converged; `renderPose` is usable.
 * - `lost`      — was `tracking`, the smoothed estimate stopped accepting
 *   hits (e.g. the device moved out of view of anything matchable). Distinct
 *   from `mapLoaded` so an app can tell "never found it" from "found it, then
 *   lost it".
 * - `error`     — the map failed to load, no location/map was found, or the
 *   renderer reports no ReactVision provider configured.
 */
export type ViroVPSTrackingState =
  | "idle"
  | "searching"
  | "mapLoaded"
  | "tracking"
  | "lost"
  | "error";

export type ViroVPSTrackingPhase = {
  state: ViroVPSTrackingState;
  /**
   * True once `tracking` has been reached at least once since the map now
   * loaded. Carried forward so a later non-converged tick resolves to `lost`
   * rather than back to `mapLoaded`.
   */
  everConverged: boolean;
};

export const VPS_TRACKING_IDLE: ViroVPSTrackingPhase = {
  state: "idle",
  everConverged: false,
};

/**
 * One poll tick of `getVPSLocalization()` applied to the current phase.
 *
 * `available: false` (no ReactVision provider configured) always resolves to
 * `error`, even mid-tracking — there is no smoothed estimate to keep
 * reporting on top of.
 *
 * `loaded: false` while the phase is not already `idle`/`searching` means the
 * map was dropped out from under a poll in flight (e.g. a concurrent
 * stopTracking() raced the timer) — treated the same as having already gone
 * idle, rather than as an error.
 */
export function nextTrackingPhase(
  phase: ViroVPSTrackingPhase,
  localization: ViroVPSLocalizationResult
): ViroVPSTrackingPhase {
  if (!localization.available) {
    return { state: "error", everConverged: false };
  }
  if (!localization.loaded) {
    return VPS_TRACKING_IDLE;
  }
  if (localization.converged) {
    return { state: "tracking", everConverged: true };
  }
  return {
    state: phase.everConverged ? "lost" : "mapLoaded",
    everConverged: phase.everConverged,
  };
}

/**
 * Whether a poll tick's converged pose is new enough to hand to `onLocalized`.
 *
 * Fires once per genuinely new pose rather than once per tick that happens to
 * be converged: two ticks answering with the same `renderPose` string (e.g. a
 * poll that lands between two native frames) should not double-fire.
 */
export function isFreshLocalizedPose(
  previousRenderPose: string | undefined,
  localization: ViroVPSLocalizationResult
): localization is ViroVPSLocalizationResult & { renderPose: string } {
  return (
    localization.converged === true &&
    typeof localization.renderPose === "string" &&
    localization.renderPose.length > 0 &&
    localization.renderPose !== previousRenderPose
  );
}
