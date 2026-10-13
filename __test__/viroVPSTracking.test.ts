/**
 * nextTrackingPhase()/isFreshLocalizedPose() are pure functions with no
 * native/bridge dependency, so the <ViroVPS> state machine can be checked
 * directly here, against a scripted sequence of getVPSLocalization() polls —
 * same reasoning as vpsMapDownload.test.ts's bytesToBase64 coverage.
 */
import type { ViroVPSLocalizationResult } from "../components/Types/ViroEvents";
import {
  nextTrackingPhase,
  isFreshLocalizedPose,
  VPS_TRACKING_IDLE,
  ViroVPSTrackingPhase,
} from "../components/AR/ViroVPSTracking";
import { candidateLocationsForTracking } from "../components/AR/ViroVPSMapDownload";

function loc(over: Partial<ViroVPSLocalizationResult> = {}): ViroVPSLocalizationResult {
  return { available: true, loaded: true, converged: false, ...over };
}

describe("nextTrackingPhase", () => {
  it("goes to error when no ReactVision provider is configured, from any phase", () => {
    const tracking: ViroVPSTrackingPhase = { state: "tracking", everConverged: true };
    expect(nextTrackingPhase(tracking, loc({ available: false }))).toEqual({
      state: "error",
      everConverged: false,
    });
  });

  it("goes idle, not error, when the map was unloaded out from under the poll", () => {
    const mapLoaded: ViroVPSTrackingPhase = { state: "mapLoaded", everConverged: false };
    expect(nextTrackingPhase(mapLoaded, loc({ loaded: false }))).toEqual(VPS_TRACKING_IDLE);
  });

  it("stays mapLoaded while loaded but not yet converged", () => {
    const mapLoaded: ViroVPSTrackingPhase = { state: "mapLoaded", everConverged: false };
    expect(nextTrackingPhase(mapLoaded, loc({ converged: false }))).toEqual({
      state: "mapLoaded",
      everConverged: false,
    });
  });

  it("moves to tracking once converged, and remembers it", () => {
    const mapLoaded: ViroVPSTrackingPhase = { state: "mapLoaded", everConverged: false };
    expect(
      nextTrackingPhase(mapLoaded, loc({ converged: true, renderPose: "T" }))
    ).toEqual({ state: "tracking", everConverged: true });
  });

  it("stays tracking across consecutive converged ticks", () => {
    const tracking: ViroVPSTrackingPhase = { state: "tracking", everConverged: true };
    expect(
      nextTrackingPhase(tracking, loc({ converged: true, renderPose: "T2" }))
    ).toEqual({ state: "tracking", everConverged: true });
  });

  it("drops to lost, not mapLoaded, when a tracked map stops converging", () => {
    const tracking: ViroVPSTrackingPhase = { state: "tracking", everConverged: true };
    expect(nextTrackingPhase(tracking, loc({ converged: false }))).toEqual({
      state: "lost",
      everConverged: true,
    });
  });

  it("can recover from lost back to tracking", () => {
    const lost: ViroVPSTrackingPhase = { state: "lost", everConverged: true };
    expect(
      nextTrackingPhase(lost, loc({ converged: true, renderPose: "T3" }))
    ).toEqual({ state: "tracking", everConverged: true });
  });
});

describe("isFreshLocalizedPose", () => {
  it("is false while not converged", () => {
    expect(isFreshLocalizedPose(undefined, loc({ converged: false }))).toBe(false);
  });

  it("is false without a renderPose even if converged", () => {
    expect(isFreshLocalizedPose(undefined, loc({ converged: true }))).toBe(false);
  });

  it("is true for a first converged pose", () => {
    expect(isFreshLocalizedPose(undefined, loc({ converged: true, renderPose: "A" }))).toBe(
      true
    );
  });

  it("is false for a repeat of the same pose", () => {
    expect(isFreshLocalizedPose("A", loc({ converged: true, renderPose: "A" }))).toBe(false);
  });

  it("is true once the pose actually changes", () => {
    expect(isFreshLocalizedPose("A", loc({ converged: true, renderPose: "B" }))).toBe(true);
  });
});

describe("candidateLocationsForTracking", () => {
  const nearby = [
    { id: "a", name: "A", lat: 0, lon: 0, active_scan_id: "scan-a", distance_m: 5, created_at: 0 },
    { id: "b", name: "B", lat: 0, lon: 0, active_scan_id: null, distance_m: 10, created_at: 0 },
    { id: "c", name: "C", lat: 0, lon: 0, active_scan_id: "scan-c", distance_m: 15, created_at: 0 },
  ];

  it("drops locations with no active scan and keeps nearest-first order", () => {
    expect(candidateLocationsForTracking(nearby).map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("returns an empty list when nothing is trackable", () => {
    expect(
      candidateLocationsForTracking([
        { id: "x", name: "X", lat: 0, lon: 0, active_scan_id: null, distance_m: 1, created_at: 0 },
      ])
    ).toEqual([]);
  });
});
