"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioPlacementStore = void 0;
const utils_1 = require("./utils");
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
class StudioPlacementStore {
    status = new Map();
    positions = new Map();
    order = [];
    keyed = new utils_1.KeyedListeners();
    active = new utils_1.GlobalListeners();
    /** Initialise-if-absent from the tap_to_place flag (idempotent, strict-mode safe). */
    seed(assets) {
        for (const asset of assets) {
            if (!asset?.id || !asset.tap_to_place)
                continue;
            if (this.status.has(asset.id))
                continue;
            this.status.set(asset.id, "unplaced");
            this.order.push(asset.id);
        }
    }
    /** Re-initialise for a new scene, then wake every subscriber. */
    reseed(assets) {
        this.status.clear();
        this.positions.clear();
        this.order = [];
        for (const asset of assets) {
            if (!asset?.id || !asset.tap_to_place)
                continue;
            this.status.set(asset.id, "unplaced");
            this.order.push(asset.id);
        }
        this.keyed.notifyAll();
        this.active.notify();
    }
    /** True for assets this store gates (tap_to_place). */
    isTracked(assetId) {
        return this.status.has(assetId);
    }
    isPlaced(assetId) {
        return this.status.get(assetId) === "placed";
    }
    getPosition(assetId) {
        return this.positions.get(assetId);
    }
    /** First still-unplaced asset in seed order, or null once all are placed. */
    activeAssetId() {
        for (const id of this.order) {
            if (this.status.get(id) === "unplaced")
                return id;
        }
        return null;
    }
    /** Record a placement. No-op if the asset is untracked or already placed. */
    place(assetId, position) {
        if (this.status.get(assetId) !== "unplaced")
            return;
        this.status.set(assetId, "placed");
        this.positions.set(assetId, position);
        if ((0, utils_1.isDev)()) {
            console.log(`[Studio] Placed "${assetId}" at`, position);
        }
        this.keyed.notify(assetId);
        this.active.notify();
    }
    /** Subscribe to one asset's placement changes; returns an unsubscribe fn. */
    subscribe(assetId, listener) {
        return this.keyed.subscribe(assetId, listener);
    }
    /** Subscribe to active-asset changes (the placement UI); returns unsubscribe. */
    subscribeActive(listener) {
        return this.active.subscribe(listener);
    }
}
exports.StudioPlacementStore = StudioPlacementStore;
