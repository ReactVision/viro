"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGazeHandler = createGazeHandler;
exports.resetGazeStates = resetGazeStates;
const sceneNavigationHandler_1 = require("./sceneNavigationHandler");
// Grace/cooldown when the binding leaves hysteresis at 0: a small default so an
// eye-gaze flicker at the target edge can't reset the dwell or re-fire on spam.
const DEFAULT_HYSTERESIS_MS = 250;
function getState(stateRef, id) {
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
function attemptFire(binding, state, ctx, cooldownMs) {
    if (state.firedThisLook)
        return;
    if (binding.fire_mode === "one_shot" && state.fired)
        return;
    const now = Date.now();
    if (now - state.lastFired < cooldownMs)
        return;
    state.firedThisLook = true;
    state.fired = true;
    state.lastFired = now;
    const fn = binding.scene_function;
    if (!fn)
        return;
    (0, sceneNavigationHandler_1.executeFunctionWithRelations)(fn, ctx.sceneNavigator, ctx.animations, ctx.onAnimationTrigger, 0, ctx.onSceneChange, ctx.runtimeCtx);
}
/**
 * Builds the target node's `onGaze` callback from every gaze binding on that
 * asset. Fires the bound function after a sustained look (`dwell_seconds`),
 * forgiving a brief look-away for `hysteresis_seconds` (grace) and gating
 * re-fires by the same window (cooldown). one_shot fires once ever; repeating
 * fires once per look.
 */
function createGazeHandler(bindings, ctx, stateRef) {
    return (isHovering) => {
        for (const binding of bindings) {
            const state = getState(stateRef, binding.id);
            const dwellMs = Math.max(0, binding.dwell_seconds * 1000);
            const hystMs = binding.hysteresis_seconds > 0
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
                    if (state.dwellTimer)
                        clearTimeout(state.dwellTimer);
                    state.dwellTimer = setTimeout(() => {
                        state.dwellTimer = null;
                        attemptFire(binding, state, ctx, hystMs);
                    }, dwellMs);
                }
            }
            else if (state.looking && !state.releaseTimer) {
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
function resetGazeStates(stateRef) {
    for (const state of stateRef.current.values()) {
        if (state.dwellTimer)
            clearTimeout(state.dwellTimer);
        if (state.releaseTimer)
            clearTimeout(state.releaseTimer);
    }
    stateRef.current.clear();
}
