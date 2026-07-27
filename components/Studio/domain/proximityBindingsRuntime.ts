import { MutableRefObject } from "react";
import { StudioAnimation, StudioProximityBinding } from "../types";
import {
  executeFunctionWithRelations,
  SequenceRuntimeContext,
} from "./sceneNavigationHandler";

const DEFAULT_COOLDOWN_MS = 750;

// Hysteresis: the user must retreat past distance + band before an "exit" (and
// before a re-entry can fire), so jitter right at the threshold can't spam.
const HYST_MIN_M = 0.1;
const HYST_FRACTION = 0.1;

type Vec3 = [number, number, number];

export type ProximityRuntimeState = {
  /** Whether the user is currently within the enter radius. */
  inside: boolean;
  /** One-shot latch: set once fired, never reset until scene change. */
  fired: boolean;
  /** Last time this binding fired, for the anti-spam cooldown. */
  lastFired: number;
  /** False until the first evaluation primes `inside` (no phantom fire). */
  primed: boolean;
};

function distance3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Evaluates proximity bindings against the user's current world position and
 * fires the bound function on a qualifying threshold crossing. Mirrors the
 * collision dispatch tail; the difference is the user-vs-object distance test
 * plus a hysteresis/direction/fire-mode state machine per binding.
 */
export function evaluateProximityBindings(params: {
  cameraPosition: Vec3;
  bindings: StudioProximityBinding[];
  getTargetWorldPosition: (assetId: string) => Vec3 | undefined;
  stateRef: MutableRefObject<Map<string, ProximityRuntimeState>>;
  sceneNavigator?: unknown;
  animations: StudioAnimation[];
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void;
  cooldownMs?: number;
  runtimeCtx?: SequenceRuntimeContext;
}): void {
  const {
    cameraPosition,
    bindings,
    getTargetWorldPosition,
    stateRef,
    sceneNavigator,
    animations,
    onSceneChange,
    onAnimationTrigger,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    runtimeCtx,
  } = params;

  if (!bindings.length) return;

  const now = Date.now();
  const states = stateRef.current;

  for (const binding of bindings) {
    const targetPos = getTargetWorldPosition(binding.target_asset_id);
    if (!targetPos) continue;

    const d = distance3D(cameraPosition, targetPos);
    const band = Math.max(HYST_MIN_M, HYST_FRACTION * binding.distance);
    const enterR = binding.distance;
    const exitR = binding.distance + band;

    let state = states.get(binding.id);
    if (!state) {
      state = { inside: false, fired: false, lastFired: 0, primed: false };
      states.set(binding.id, state);
    }

    // First evaluation only primes the latch — a user who spawns already inside
    // the radius shouldn't get a phantom "entering" fire.
    if (!state.primed) {
      state.inside = d <= enterR;
      state.primed = true;
      continue;
    }

    let crossed: "in" | "out" | null = null;
    if (!state.inside && d <= enterR) {
      state.inside = true;
      crossed = "in";
    } else if (state.inside && d >= exitR) {
      state.inside = false;
      crossed = "out";
    }
    if (!crossed) continue;

    const wantsFire =
      (crossed === "in" &&
        (binding.direction === "entering" ||
          binding.direction === "either")) ||
      (crossed === "out" &&
        (binding.direction === "exiting" || binding.direction === "either"));
    if (!wantsFire) continue;

    if (binding.fire_mode === "one_shot" && state.fired) continue;
    if (now - state.lastFired < cooldownMs) continue;

    state.fired = true;
    state.lastFired = now;

    const fn = binding.scene_function;
    if (!fn) continue;

    executeFunctionWithRelations(
      fn,
      sceneNavigator,
      animations,
      onAnimationTrigger,
      0,
      onSceneChange,
      runtimeCtx
    );
  }
}
