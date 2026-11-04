/**
 * Copyright © 2026 ReactVision
 *
 * @providesModule ViroCaptureGuidance
 */

"use strict";

import type { Viro3DPoint } from "../Types/ViroUtils";

/**
 * What to tell someone recording a space: turning too fast, pointing at the
 * floor or ceiling, too close to a surface, or looking at something with no
 * detail. Ids only; the wording is the app's.
 */
export type ViroCaptureHint = "fast" | "pitch" | "close" | "blank";

/** Every hint, in the order one is chosen when several hold at once. */
export const VIRO_CAPTURE_HINTS: readonly ViroCaptureHint[] = [
  "fast",
  "pitch",
  "close",
  "blank",
];

export type ViroCaptureRules = {
  /** Turning faster than this, in degrees per second... */
  fastDegS: number;
  /** ...for longer than this many seconds shows `fast`. */
  fastHoldS: number;
  /** Looking more than this many degrees above or below the horizon... */
  pitchDeg: number;
  /** ...for this long shows `pitch`. */
  pitchHoldS: number;
  /** A centre hit nearer than this many metres... */
  closeM: number;
  /** ...for this long shows `close`. */
  closeHoldS: number;
  /** The centre hit test finding nothing for this long shows `blank`. */
  blankHoldS: number;
  /** One pose step longer than this many metres is a tracking jump. */
  jumpM: number;
  /** One pose step turning more than this many degrees is a tracking jump. */
  jumpDeg: number;
  /** Steps across a longer gap than this (a stalled JS thread) are not judged as jumps. */
  jumpMaxGapS: number;
  /** The turn rate is measured over this many seconds of poses. */
  rateWindowS: number;
};

/** The default rules. Pass a partial override to `createViroCaptureGuidance`. */
export const VIRO_CAPTURE_RULES: Readonly<ViroCaptureRules> = {
  fastDegS: 30,
  fastHoldS: 1,
  pitchDeg: 60,
  pitchHoldS: 2,
  closeM: 0.5,
  closeHoldS: 2,
  blankHoldS: 2,
  jumpM: 0.3,
  jumpDeg: 30,
  jumpMaxGapS: 0.2,
  rateWindowS: 0.3,
};

export type ViroCaptureGuidanceState = {
  /** The hint to show now, or null. */
  hint: ViroCaptureHint | null;
  /** How long each hint has been shown in total, in seconds. */
  seconds: Record<ViroCaptureHint, number>;
  /** Tracking jumps seen so far. Any jump usually means the recording should be made again. */
  jumps: number;
};

export type ViroCaptureGuidance = {
  /** A camera pose at time `t` (seconds), in Viro's world space (Y up). */
  pose(t: number, position: Viro3DPoint, forward: Viro3DPoint, up: Viro3DPoint): void;
  /** The centre hit test at time `t`: the distance to what it hit, or null when it hit nothing. */
  hit(t: number, distance: number | null): void;
  /** At time `t`, `dt` seconds after the previous tick: the hint to show and the totals so far. */
  tick(t: number, dt: number): ViroCaptureGuidanceState;
};

type Vec3 = [number, number, number];
type Basis = [Vec3, Vec3, Vec3]; // right, up, forward

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const deg = (r: number) => (r * 180) / Math.PI;
const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

function basis(forward: Vec3, up: Vec3): Basis {
  const f = unit(forward);
  const r = unit(cross(f, up));
  return [r, cross(r, f), f];
}

// The angle between two orientations: acos((trace(A^T B) - 1) / 2).
function angleDeg(a: Basis, b: Basis): number {
  const tr = dot(a[0], b[0]) + dot(a[1], b[1]) + dot(a[2], b[2]);
  return deg(Math.acos(clampUnit((tr - 1) / 2)));
}

/**
 * Live capture guidance for recording a space, from the camera's pose and a
 * hit test at the centre of the view. Pure: feed it poses from
 * `onCameraTransformUpdate`, hit distances, and a tick on a timer, or use
 * `useViroCaptureGuidance`, which does all three.
 *
 * A hint shows once its condition has held for its hold time, and stops the
 * moment the condition clears.
 */
export function createViroCaptureGuidance(
  rules?: Partial<ViroCaptureRules>
): ViroCaptureGuidance {
  const r: ViroCaptureRules = { ...VIRO_CAPTURE_RULES, ...rules };
  const holdS: Record<ViroCaptureHint, number> = {
    fast: r.fastHoldS,
    pitch: r.pitchHoldS,
    close: r.closeHoldS,
    blank: r.blankHoldS,
  };
  let track: { t: number; R: Basis; p: Vec3 }[] = [];
  const since: Partial<Record<ViroCaptureHint, number>> = {};
  const seconds: Record<ViroCaptureHint, number> = {
    fast: 0,
    pitch: 0,
    close: 0,
    blank: 0,
  };
  let jumps = 0;

  const hold = (h: ViroCaptureHint, on: boolean, t: number) => {
    if (!on) delete since[h];
    else if (since[h] === undefined) since[h] = t;
  };

  return {
    pose(t, position, forward, up) {
      const R = basis(forward, up);
      const p: Vec3 = [position[0], position[1], position[2]];
      const last = track[track.length - 1];
      if (
        last &&
        t - last.t <= r.jumpMaxGapS &&
        (norm(sub(p, last.p)) > r.jumpM || angleDeg(last.R, R) > r.jumpDeg)
      ) {
        jumps++;
        track = []; // a jump is not a turn: the rate starts again from here
      }
      track.push({ t, R, p });
      while (track.length > 2 && t - track[1].t >= r.rateWindowS) {
        track.shift();
      }
      const first = track[0];
      const span = t - first.t;
      const rate = span >= r.rateWindowS / 2 ? angleDeg(first.R, R) / span : 0;
      hold("fast", rate > r.fastDegS, t);
      const pitch = deg(Math.asin(clampUnit(R[2][1])));
      hold("pitch", Math.abs(pitch) > r.pitchDeg, t);
    },
    hit(t, distance) {
      hold("close", distance !== null && distance < r.closeM, t);
      hold("blank", distance === null, t);
    },
    tick(t, dt) {
      const shown = VIRO_CAPTURE_HINTS.filter((h) => {
        const start = since[h];
        return start !== undefined && t - start >= holdS[h];
      });
      for (const h of shown) seconds[h] += dt;
      return { hint: shown[0] ?? null, seconds: { ...seconds }, jumps };
    },
  };
}

/** The shape of a hit test result this module reads. */
export type ViroCaptureHitResult = { transform: { position: Viro3DPoint } };

/** The distance from the camera to the nearest hit test result, or null without one. */
export function nearestHitDistance(
  camera: Viro3DPoint,
  results: readonly ViroCaptureHitResult[] | null | undefined
): number | null {
  if (!results?.length) return null;
  const c: Vec3 = [camera[0], camera[1], camera[2]];
  return Math.min(
    ...results.map((hit) => {
      const p = hit.transform.position;
      return norm(sub([p[0], p[1], p[2]], c));
    })
  );
}

export type ViroCaptureHitSamplerOptions = {
  /** Runs one hit test at the centre of the view. */
  hitTest: () => Promise<readonly ViroCaptureHitResult[] | null | undefined>;
  /** The camera position now, or null before the first pose. No hit test runs without one. */
  getCameraPosition: () => Viro3DPoint | null;
  /** Called with the nearest hit's distance from the camera when the result arrives. */
  reportHit: (distance: number | null) => void;
  /**
   * A hit test still pending after this many milliseconds no longer blocks the
   * next one, and its result is dropped once a newer one has started.
   */
  timeoutMs?: number;
};

export type ViroCaptureHitSampler = {
  /** Starts a hit test unless one is already running. */
  sample(): void;
  /** Drops any pending result and stops further samples. */
  cancel(): void;
};

/**
 * Runs the centre hit test one at a time for capture guidance.
 *
 * A native hit test can leave its promise pending for good (seen on Android),
 * so a pending test is given up on after `timeoutMs` rather than stalling
 * every sample after it. A failed hit test reports nothing.
 */
export function createViroCaptureHitSampler(
  options: ViroCaptureHitSamplerOptions
): ViroCaptureHitSampler {
  const { hitTest, getCameraPosition, reportHit, timeoutMs = 1000 } = options;
  let busy = false;
  let id = 0;
  let cancelled = false;
  let abandon: ReturnType<typeof setTimeout> | null = null;

  return {
    sample() {
      if (cancelled || busy || !getCameraPosition()) return;
      busy = true;
      const mine = ++id;
      const timer = setTimeout(() => {
        if (id === mine) busy = false;
      }, timeoutMs);
      abandon = timer;
      let pending: Promise<readonly ViroCaptureHitResult[] | null | undefined>;
      try {
        pending = Promise.resolve(hitTest());
      } catch (e) {
        pending = Promise.reject(e);
      }
      pending
        .then((results) => {
          if (cancelled || id !== mine) return;
          const camera = getCameraPosition();
          if (camera) reportHit(nearestHitDistance(camera, results));
        })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer);
          if (id === mine) busy = false;
        });
    },
    cancel() {
      cancelled = true;
      id++;
      if (abandon) clearTimeout(abandon);
      abandon = null;
    },
  };
}
