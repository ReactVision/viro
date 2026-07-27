import { MutableRefObject } from "react";
import { StudioAnimation, StudioProximityBinding } from "../types";
import { SequenceRuntimeContext } from "./sceneNavigationHandler";
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
/**
 * Evaluates proximity bindings against the user's current world position and
 * fires the bound function on a qualifying threshold crossing. Mirrors the
 * collision dispatch tail; the difference is the user-vs-object distance test
 * plus a hysteresis/direction/fire-mode state machine per binding.
 */
export declare function evaluateProximityBindings(params: {
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
}): void;
export {};
