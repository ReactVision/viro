import type { StudioSceneResponse } from "../types";
/**
 * Below the relay's 512-entity room cap, leaving room for entities a host app
 * or a later scene adds.
 */
export declare const STUDIO_COLOCATION_ENTITY_LIMIT = 480;
/**
 * Entities a shared session of this scene can hold at once: one per variable,
 * one visibility row per asset, one placement per tap-to-place asset and one
 * drag per draggable asset.
 */
export declare function estimateSharedEntities(sceneData: StudioSceneResponse): number;
