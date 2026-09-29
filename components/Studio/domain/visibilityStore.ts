import { StudioAsset } from "../types";
import {
  ChangeListeners,
  KeyedListeners,
  isDev,
  type StudioChangeOrigin,
  type StudioStoreChangeListener,
} from "./utils";

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
export class StudioVisibilityStore {
  private visible = new Map<string, boolean>();
  private listeners = new KeyedListeners();
  private changes = new ChangeListeners();

  /** Current visibility; defaults to visible for assets never seeded/set. */
  isVisible(assetId: string): boolean {
    return this.visible.get(assetId) ?? true;
  }

  /** Subscribe to changes for one asset; returns an unsubscribe fn. */
  subscribe(assetId: string, listener: () => void): () => void {
    return this.listeners.subscribe(assetId, listener);
  }

  /** Each change with its asset id (null after a reseed) and its origin. */
  subscribeChanges(listener: StudioStoreChangeListener): () => void {
    return this.changes.subscribe(listener);
  }

  /** Initialise-if-absent from author-time defaults (idempotent, strict-mode safe). */
  seed(assets: StudioAsset[]): void {
    for (const asset of assets) {
      if (!asset?.id) continue;
      if (this.visible.has(asset.id)) continue;
      this.visible.set(asset.id, !asset.hidden_on_load);
    }
  }

  /**
   * Apply a Set Visibility action. TOGGLE flips the live value; VISIBLE/HIDDEN
   * set it absolutely. No-op writes don't wake subscribers.
   */
  apply(
    assetId: string,
    state: "VISIBLE" | "HIDDEN" | "TOGGLE",
    origin: StudioChangeOrigin = "local"
  ): void {
    const next =
      state === "TOGGLE" ? !this.isVisible(assetId) : state === "VISIBLE";
    if (this.visible.get(assetId) === next) return;
    this.visible.set(assetId, next);
    if (isDev()) {
      console.log(`[Studio] Visibility "${assetId}" =`, next);
    }
    this.listeners.notify(assetId);
    this.changes.notify(assetId, origin);
  }

  /**
   * Re-initialise for a new scene: replace all values from author-time
   * defaults, THEN notify every subscribed asset so mounted nodes re-read.
   * Order matters — notifying before re-seeding would briefly surface the
   * visible default for an asset that starts hidden.
   */
  reseed(assets: StudioAsset[]): void {
    this.visible.clear();
    for (const asset of assets) {
      if (!asset?.id) continue;
      this.visible.set(asset.id, !asset.hidden_on_load);
    }
    this.listeners.notifyAll();
    this.changes.notify(null, "local");
  }
}
