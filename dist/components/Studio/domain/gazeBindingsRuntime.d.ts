import { MutableRefObject } from "react";
import { StudioAnimation, StudioGazeBinding } from "../types";
import { SequenceRuntimeContext } from "./sceneNavigationHandler";
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
/**
 * Builds the target node's `onGaze` callback from every gaze binding on that
 * asset. Fires the bound function after a sustained look (`dwell_seconds`),
 * forgiving a brief look-away for `hysteresis_seconds` (grace) and gating
 * re-fires by the same window (cooldown). one_shot fires once ever; repeating
 * fires once per look.
 */
export declare function createGazeHandler(bindings: StudioGazeBinding[], ctx: GazeDispatchContext, stateRef: MutableRefObject<Map<string, GazeRuntimeState>>): (isHovering: boolean, position: [number, number, number], source: number) => void;
/** Cancels every pending timer and clears the map — call on scene change and
 * unmount so a spent dwell can't fire into a torn-down scene. */
export declare function resetGazeStates(stateRef: MutableRefObject<Map<string, GazeRuntimeState>>): void;
