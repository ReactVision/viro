import { StudioAsset } from "../types";
type Vec3 = [number, number, number];
/**
 * Per-scene store for tap-to-place assets, keyed by asset placement id. A
 * tap-to-place asset is withheld from the scene until the end user places it,
 * then rendered at the placed world position. Placement is ephemeral runtime
 * state: nothing is persisted, so reopening the scene starts unplaced again.
 *
 * Two listener sets: per-asset (a placement repaints only that node) and a
 * global one (the placement UI re-reads which asset is active). Placement is
 * a guided queue — one asset at a time, in seed order.
 */
export declare class StudioPlacementStore {
    private status;
    private positions;
    private order;
    private keyed;
    private active;
    /** Initialise-if-absent from the tap_to_place flag (idempotent, strict-mode safe). */
    seed(assets: StudioAsset[]): void;
    /** Re-initialise for a new scene, then wake every subscriber. */
    reseed(assets: StudioAsset[]): void;
    /** True for assets this store gates (tap_to_place). */
    isTracked(assetId: string): boolean;
    isPlaced(assetId: string): boolean;
    getPosition(assetId: string): Vec3 | undefined;
    /** First still-unplaced asset in seed order, or null once all are placed. */
    activeAssetId(): string | null;
    /** Record a placement. No-op if the asset is untracked or already placed. */
    place(assetId: string, position: Vec3): void;
    /** Subscribe to one asset's placement changes; returns an unsubscribe fn. */
    subscribe(assetId: string, listener: () => void): () => void;
    /** Subscribe to active-asset changes (the placement UI); returns unsubscribe. */
    subscribeActive(listener: () => void): () => void;
}
export {};
