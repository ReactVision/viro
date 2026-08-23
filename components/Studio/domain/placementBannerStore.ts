import { GlobalListeners } from "./utils";

/**
 * The mobile tap-to-place prompt ("Tap a surface to place …") is a single-active
 * affordance (the guided queue exposes one asset at a time), so this module
 * singleton mirrors the active asset's name and the transient "missed the
 * surface" hint. The navigator's placement overlay writes it; an indicator
 * subscribes so the host can render the prompt in its own chrome.
 */
class StudioPlacementBannerStore {
  private active = false;
  private assetName: string | null = null;
  private miss = false;
  private listeners = new GlobalListeners();

  isActive(): boolean {
    return this.active;
  }

  /** Name of the asset awaiting placement, or null. */
  name(): string | null {
    return this.assetName;
  }

  /** True while the most recent tap missed every surface (auto-clears). */
  showMiss(): boolean {
    return this.miss;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  set(active: boolean, name: string | null): void {
    if (this.active === active && this.assetName === name) return;
    this.active = active;
    this.assetName = name;
    if (!active) this.miss = false;
    this.listeners.notify();
  }

  setShowMiss(miss: boolean): void {
    if (this.miss === miss) return;
    this.miss = miss;
    this.listeners.notify();
  }

  /** Force idle so a torn-down placement can't wedge the prompt on. */
  reset(): void {
    if (!this.active && this.assetName === null && !this.miss) return;
    this.active = false;
    this.assetName = null;
    this.miss = false;
    this.listeners.notify();
  }
}

export const studioPlacementBannerStore = new StudioPlacementBannerStore();
