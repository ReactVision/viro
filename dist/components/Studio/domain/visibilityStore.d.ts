import { StudioAsset } from "../types";
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
export declare class StudioVisibilityStore {
    private visible;
    private listeners;
    /** Current visibility; defaults to visible for assets never seeded/set. */
    isVisible(assetId: string): boolean;
    /** Subscribe to changes for one asset; returns an unsubscribe fn. */
    subscribe(assetId: string, listener: () => void): () => void;
    /** Initialise-if-absent from author-time defaults (idempotent, strict-mode safe). */
    seed(assets: StudioAsset[]): void;
    /**
     * Apply a Set Visibility action. TOGGLE flips the live value; VISIBLE/HIDDEN
     * set it absolutely. No-op writes don't wake subscribers.
     */
    apply(assetId: string, state: "VISIBLE" | "HIDDEN" | "TOGGLE"): void;
    /**
     * Re-initialise for a new scene: replace all values from author-time
     * defaults, THEN notify every subscribed asset so mounted nodes re-read.
     * Order matters — notifying before re-seeding would briefly surface the
     * visible default for an asset that starts hidden.
     */
    reseed(assets: StudioAsset[]): void;
}
