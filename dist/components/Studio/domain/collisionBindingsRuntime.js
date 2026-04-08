"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchCollisionBindingActions = dispatchCollisionBindingActions;
exports.createPlacementCollisionHandler = createPlacementCollisionHandler;
const collisionPairKey_1 = require("./collisionPairKey");
const sceneNavigationHandler_1 = require("./sceneNavigationHandler");
const DEFAULT_COOLDOWN_MS = 750;
function pairCooldownKey(pairKey, functionId) {
    return `${pairKey}::${functionId}`;
}
/**
 * Dispatches scene functions for collision bindings matching the canonical pair.
 * Cooldown prevents per-frame spam while physics contacts overlap.
 */
function dispatchCollisionBindingActions(params) {
    const { selfPlacementId, otherTag, bindingsByPairKey, sceneNavigator, animations, onSceneChange, onAnimationTrigger, cooldownMs = DEFAULT_COOLDOWN_MS, lastFiredRef, } = params;
    if (!otherTag)
        return;
    const { asset_x_id, asset_y_id } = (0, collisionPairKey_1.canonicalizeCollisionAssetIds)(selfPlacementId, otherTag);
    const pKey = (0, collisionPairKey_1.collisionPairKey)(asset_x_id, asset_y_id);
    const rows = bindingsByPairKey.get(pKey);
    if (!rows?.length)
        return;
    const now = Date.now();
    const map = lastFiredRef.current;
    for (const row of rows) {
        const fn = row.scene_function;
        if (!fn)
            continue;
        const ck = pairCooldownKey(pKey, row.function_id);
        const last = map.get(ck) ?? 0;
        if (now - last < cooldownMs)
            continue;
        map.set(ck, now);
        (0, sceneNavigationHandler_1.executeFunctionWithRelations)(fn, sceneNavigator, animations, onAnimationTrigger, 0, onSceneChange);
    }
}
/**
 * Returns an onCollision handler for a given placement asset ID.
 */
function createPlacementCollisionHandler(placementId, bindingsByPairKey, sceneNavigator, animations, lastFiredRef, onAnimationTrigger, onSceneChange) {
    return (viroTag) => {
        dispatchCollisionBindingActions({
            selfPlacementId: placementId,
            otherTag: viroTag,
            bindingsByPairKey,
            sceneNavigator,
            animations,
            onSceneChange,
            onAnimationTrigger,
            lastFiredRef,
        });
    };
}
