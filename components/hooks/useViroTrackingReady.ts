/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule useViroTrackingReady
 */

"use strict";

import { useCallback, useEffect, useRef, useState } from "react";
import { ViroTrackingStateConstants } from "../ViroConstants";
import type { ViroTrackingState } from "../Types/ViroEvents";

export type ViroTrackingReadyOptions = {
  /** How long tracking must stay normal before it is ready, in milliseconds. Defaults to 1000. */
  normalMs?: number;
  /**
   * How long tracking must stay limited before it is ready anyway, in
   * milliseconds. Defaults to 4000, so a device that never reaches normal
   * tracking can still go ahead.
   */
  limitedMs?: number;
};

export type ViroTrackingReadyResult = {
  /** True once the current tracking state has held for its wait. Any change of state starts the wait again. */
  ready: boolean;
  /**
   * Seconds tracking has spent in any state other than normal (limited or
   * unavailable) since the hook mounted or `resetLimitedSeconds` was last
   * called, up to now.
   */
  getLimitedSeconds: () => number;
  /** Starts the `getLimitedSeconds` count again from zero, for example when a recording starts. */
  resetLimitedSeconds: () => void;
};

/** Tracking state over time, as `viroTrackingReadinessReducer` keeps it. Times are in milliseconds. */
export type ViroTrackingReadiness = {
  state: ViroTrackingState | null;
  /** When `state` began. */
  since: number;
  /** Time spent other than normal before `countedTo`. */
  limitedMs: number;
  countedTo: number;
};

export type ViroTrackingReadinessAction =
  | { type: "state"; state: ViroTrackingState | null; at: number }
  | { type: "resetCount"; at: number };

const isNormal = (state: ViroTrackingState | null) =>
  state === ViroTrackingStateConstants.TRACKING_NORMAL;

export function createViroTrackingReadiness(
  state: ViroTrackingState | null,
  at: number
): ViroTrackingReadiness {
  return { state, since: at, limitedMs: 0, countedTo: at };
}

/** Returns the same object when nothing changed. */
export function viroTrackingReadinessReducer(
  r: ViroTrackingReadiness,
  action: ViroTrackingReadinessAction
): ViroTrackingReadiness {
  switch (action.type) {
    case "state":
      if (action.state === r.state) return r;
      return {
        state: action.state,
        since: action.at,
        limitedMs: viroTrackingLimitedMs(r, action.at),
        countedTo: action.at,
      };
    case "resetCount":
      return { ...r, limitedMs: 0, countedTo: action.at };
  }
}

/** Milliseconds spent other than normal, up to `at`. */
export function viroTrackingLimitedMs(r: ViroTrackingReadiness, at: number): number {
  return r.limitedMs + (isNormal(r.state) ? 0 : Math.max(0, at - r.countedTo));
}

/** Milliseconds until tracking is ready at `at`: 0 when it is, null when the current state never will be. */
export function viroTrackingReadyInMs(
  r: ViroTrackingReadiness,
  at: number,
  options?: ViroTrackingReadyOptions
): number | null {
  const { normalMs = 1000, limitedMs = 4000 } = options ?? {};
  const wait = isNormal(r.state)
    ? normalMs
    : r.state === ViroTrackingStateConstants.TRACKING_LIMITED
    ? limitedMs
    : null;
  if (wait === null) return null;
  return Math.max(0, r.since + wait - at);
}

/**
 * Whether AR tracking has settled enough to start something that needs it,
 * such as a recording: normal for `normalMs`, or limited for `limitedMs`.
 * Pass the latest state from `onTrackingUpdated`, or undefined before the
 * first update.
 */
export function useViroTrackingReady(
  state: ViroTrackingState | null | undefined,
  options?: ViroTrackingReadyOptions
): ViroTrackingReadyResult {
  const { normalMs = 1000, limitedMs = 4000 } = options ?? {};
  const current = state ?? null;
  const recordRef = useRef<ViroTrackingReadiness | null>(null);
  if (recordRef.current === null) {
    recordRef.current = createViroTrackingReadiness(current, Date.now());
  }
  const [phase, setPhase] = useState(() => recordRef.current!);
  const [settled, setSettled] = useState<ViroTrackingReadiness | null>(null);

  useEffect(() => {
    const prev = recordRef.current!;
    const next = viroTrackingReadinessReducer(prev, {
      type: "state",
      state: current,
      at: Date.now(),
    });
    if (next === prev) return;
    recordRef.current = next;
    setPhase(next);
  }, [current]);

  useEffect(() => {
    const wait = viroTrackingReadyInMs(phase, Date.now(), { normalMs, limitedMs });
    if (wait === null) return;
    const timer = setTimeout(() => setSettled(phase), wait);
    return () => clearTimeout(timer);
  }, [phase, normalMs, limitedMs]);

  const getLimitedSeconds = useCallback(
    () => viroTrackingLimitedMs(recordRef.current!, Date.now()) / 1000,
    []
  );
  const resetLimitedSeconds = useCallback(() => {
    recordRef.current = viroTrackingReadinessReducer(recordRef.current!, {
      type: "resetCount",
      at: Date.now(),
    });
  }, []);

  return {
    // The state check covers the render between a new state and the effect that records it.
    ready: settled !== null && settled === phase && phase.state === current,
    getLimitedSeconds,
    resetLimitedSeconds,
  };
}
