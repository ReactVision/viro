import { MutableRefObject } from "react";
import { StudioAnimation, StudioGazeBinding } from "../types";
import {
  executeFunctionWithRelations,
  SequenceRuntimeContext,
} from "./sceneNavigationHandler";

// Grace/cooldown when the binding leaves hysteresis at 0: a small default so an
// eye-gaze flicker at the target edge can't reset the dwell or re-fire on spam.
const DEFAULT_HYSTERESIS_MS = 250;

// On Gaze is event-driven: viro reports `isHovering` on the target node for the
// EYE_GAZE source only (headsets with eye tracking). A dwell timer plus a
// grace/cooldown (hysteresis) is layered on top of that boolean stream, so a
// sustained look fires the bound function and a brief look-away is forgiven.
export type GazeRuntimeState = {
  /** Whether the user is currently looking (post-hysteresis). */
  looking: boolean;
  /** Pending dwell timer; fires the function when the hold elapses. */
  dwellTimer: ReturnType<typeof setTimeout> | null;
  /** Pending release timer; clears `looking` after the grace window. */
  releaseTimer: ReturnType<typeof setTimeout> | null;
  /** One-shot latch: set once fired, never reset until scene change. */
  fired: boolean;
  /** Gate a single fire per continuous look (re-armed on release). */
  firedThisLook: boolean;
  /** Last time this binding fired, for the anti-spam cooldown. */
  lastFired: number;
};

export type GazeDispatchContext = {
  sceneNavigator?: unknown;
  animations: StudioAnimation[];
  onSceneChange?: (sceneId: string, sceneName: string) => void;
  onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void;
  runtimeCtx?: SequenceRuntimeContext;
};

function getState(
  stateRef: MutableRefObject<Map<string, GazeRuntimeState>>,
  id: string
): GazeRuntimeState {
  let state = stateRef.current.get(id);
  if (!state) {
    state = {
      looking: false,
      dwellTimer: null,
      releaseTimer: null,
      fired: false,
      firedThisLook: false,
      lastFired: 0,
    };
    stateRef.current.set(id, state);
  }
  return state;
}

function attemptFire(
  binding: StudioGazeBinding,
  state: GazeRuntimeState,
  ctx: GazeDispatchContext,
  cooldownMs: number
): void {
  if (state.firedThisLook) return;
  if (binding.fire_mode === "one_shot" && state.fired) return;
  const now = Date.now();
  if (now - state.lastFired < cooldownMs) return;

  state.firedThisLook = true;
  state.fired = true;
  state.lastFired = now;

  const fn = binding.scene_function;
  if (!fn) return;
  executeFunctionWithRelations(
    fn,
    ctx.sceneNavigator,
    ctx.animations,
    ctx.onAnimationTrigger,
    0,
    ctx.onSceneChange,
    ctx.runtimeCtx
  );
}

/**
 * Builds the target node's `onGaze` callback from every gaze binding on that
 * asset. Fires the bound function after a sustained look (`dwell_seconds`),
 * forgiving a brief look-away for `hysteresis_seconds` (grace) and gating
 * re-fires by the same window (cooldown). one_shot fires once ever; repeating
 * fires once per look.
 */
export function createGazeHandler(
  bindings: StudioGazeBinding[],
  ctx: GazeDispatchContext,
  stateRef: MutableRefObject<Map<string, GazeRuntimeState>>
): (
  isHovering: boolean,
  position: [number, number, number],
  source: number
) => void {
  return (isHovering) => {
    for (const binding of bindings) {
      const state = getState(stateRef, binding.id);
      const dwellMs = Math.max(0, binding.dwell_seconds * 1000);
      const hystMs =
        binding.hysteresis_seconds > 0
          ? binding.hysteresis_seconds * 1000
          : DEFAULT_HYSTERESIS_MS;

      if (isHovering) {
        // A look-back within the grace window cancels the pending release, so
        // the in-flight dwell keeps counting.
        if (state.releaseTimer) {
          clearTimeout(state.releaseTimer);
          state.releaseTimer = null;
        }
        if (!state.looking) {
          state.looking = true;
          state.firedThisLook = false;
          if (state.dwellTimer) clearTimeout(state.dwellTimer);
          state.dwellTimer = setTimeout(() => {
            state.dwellTimer = null;
            attemptFire(binding, state, ctx, hystMs);
          }, dwellMs);
        }
      } else if (state.looking && !state.releaseTimer) {
        // Forgive a brief look-away for `hysteresis` before clearing the look;
        // clearing also cancels an unfinished dwell so it can't fire late.
        state.releaseTimer = setTimeout(() => {
          state.releaseTimer = null;
          state.looking = false;
          if (state.dwellTimer) {
            clearTimeout(state.dwellTimer);
            state.dwellTimer = null;
          }
        }, hystMs);
      }
    }
  };
}

/** Cancels every pending timer and clears the map — call on scene change and
 * unmount so a spent dwell can't fire into a torn-down scene. */
export function resetGazeStates(
  stateRef: MutableRefObject<Map<string, GazeRuntimeState>>
): void {
  for (const state of stateRef.current.values()) {
    if (state.dwellTimer) clearTimeout(state.dwellTimer);
    if (state.releaseTimer) clearTimeout(state.releaseTimer);
  }
  stateRef.current.clear();
}
