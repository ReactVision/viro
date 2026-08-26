"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioVisibilityStore = void 0;
const utils_1 = require("./utils");
/**
 * Per-scene visibility store, keyed by scene asset placement id. Seeded from
 * each asset's author-time `hidden_on_load` default at scene load; Set
 * Visibility actions then flip the live value. Toggle reads the current value
 * here, never the author default.
 *
 * Listeners are per-asset (unlike the global variable store) so a Set
 * Visibility on one object repaints only that node, not the whole scene. Node
 * factories subscribe to their own asset id.
 */
class StudioVisibilityStore {
    visible = new Map();
    listeners = new utils_1.KeyedListeners();
    /** Current visibility; defaults to visible for assets never seeded/set. */
    isVisible(assetId) {
        return this.visible.get(assetId) ?? true;
    }
    /** Subscribe to changes for one asset; returns an unsubscribe fn. */
    subscribe(assetId, listener) {
        return this.listeners.subscribe(assetId, listener);
    }
    /** Initialise-if-absent from author-time defaults (idempotent, strict-mode safe). */
    seed(assets) {
        for (const asset of assets) {
            if (!asset?.id)
                continue;
            if (this.visible.has(asset.id))
                continue;
            this.visible.set(asset.id, !asset.hidden_on_load);
        }
    }
    /**
     * Apply a Set Visibility action. TOGGLE flips the live value; VISIBLE/HIDDEN
     * set it absolutely. No-op writes don't wake subscribers.
     */
    apply(assetId, state) {
        const next = state === "TOGGLE" ? !this.isVisible(assetId) : state === "VISIBLE";
        if (this.visible.get(assetId) === next)
            return;
        this.visible.set(assetId, next);
        if ((0, utils_1.isDev)()) {
            console.log(`[Studio] Visibility "${assetId}" =`, next);
        }
        this.listeners.notify(assetId);
    }
    /**
     * Re-initialise for a new scene: replace all values from author-time
     * defaults, THEN notify every subscribed asset so mounted nodes re-read.
     * Order matters — notifying before re-seeding would briefly surface the
     * visible default for an asset that starts hidden.
     */
    reseed(assets) {
        this.visible.clear();
        for (const asset of assets) {
            if (!asset?.id)
                continue;
            this.visible.set(asset.id, !asset.hidden_on_load);
        }
        this.listeners.notifyAll();
    }
}
exports.StudioVisibilityStore = StudioVisibilityStore;
