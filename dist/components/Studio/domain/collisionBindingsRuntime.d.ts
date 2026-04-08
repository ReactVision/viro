import { MutableRefObject } from "react";
import { StudioAnimation, StudioCollisionBinding } from "../types";
/**
 * Dispatches scene functions for collision bindings matching the canonical pair.
 * Cooldown prevents per-frame spam while physics contacts overlap.
 */
export declare function dispatchCollisionBindingActions(params: {
    selfPlacementId: string;
    otherTag: string;
    bindingsByPairKey: Map<string, StudioCollisionBinding[]>;
    sceneNavigator?: unknown;
    animations: StudioAnimation[];
    onSceneChange?: (sceneId: string, sceneName: string) => void;
    onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void;
    cooldownMs?: number;
    lastFiredRef: MutableRefObject<Map<string, number>>;
}): void;
/**
 * Returns an onCollision handler for a given placement asset ID.
 */
export declare function createPlacementCollisionHandler(placementId: string, bindingsByPairKey: Map<string, StudioCollisionBinding[]>, sceneNavigator: unknown, animations: StudioAnimation[], lastFiredRef: MutableRefObject<Map<string, number>>, onAnimationTrigger?: (targetAssetId: string, animationKey: string) => void, onSceneChange?: (sceneId: string, sceneName: string) => void): (viroTag: string, collidedPoint: [number, number, number], collidedNormal: [number, number, number]) => void;
