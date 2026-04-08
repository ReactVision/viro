"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalizeCollisionAssetIds = canonicalizeCollisionAssetIds;
exports.collisionPairKey = collisionPairKey;
/**
 * Canonical collision pair — matches DB constraint where asset_x_id < asset_y_id lexicographically.
 */
function canonicalizeCollisionAssetIds(a, b) {
    return a < b
        ? { asset_x_id: a, asset_y_id: b }
        : { asset_x_id: b, asset_y_id: a };
}
function collisionPairKey(assetX, assetY) {
    return `${assetX}|${assetY}`;
}
