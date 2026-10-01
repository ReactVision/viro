"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STUDIO_COLOCATION_ENTITY_LIMIT = void 0;
exports.estimateSharedEntities = estimateSharedEntities;
const placementStore_1 = require("../domain/placementStore");
/**
 * Below the relay's 512-entity room cap, leaving room for entities a host app
 * or a later scene adds.
 */
exports.STUDIO_COLOCATION_ENTITY_LIMIT = 480;
/** `scene:origin` and `scene:current`. */
const FIXED_ENTITIES = 2;
/** One `evt:<peerId>` and one `peer:<peerId>` row per device, up to the relay's peer ceiling. */
const PEER_ROWS = 2 * 16;
/**
 * Entities a shared session of this scene can hold at once: one per variable,
 * one visibility row per asset, one placement per tap-to-place asset and one
 * drag per draggable asset.
 */
function estimateSharedEntities(sceneData) {
    const assets = sceneData.assets ?? [];
    return (FIXED_ENTITIES +
        (sceneData.variables?.length ?? 0) +
        assets.length +
        assets.filter((a) => (0, placementStore_1.isTapToPlaceAsset)(a)).length +
        assets.filter((a) => a.is_draggable).length +
        PEER_ROWS);
}
