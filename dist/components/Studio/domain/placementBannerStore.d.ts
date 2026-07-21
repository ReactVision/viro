/**
 * The mobile tap-to-place prompt ("Tap a surface to place …") is a single-active
 * affordance (the guided queue exposes one asset at a time), so this module
 * singleton mirrors the active asset's name and the transient "missed the
 * surface" hint. The navigator's placement overlay writes it; an indicator
 * subscribes so the host can render the prompt in its own chrome.
 */
declare class StudioPlacementBannerStore {
    private active;
    private assetName;
    private miss;
    private listeners;
    isActive(): boolean;
    /** Name of the asset awaiting placement, or null. */
    name(): string | null;
    /** True while the most recent tap missed every surface (auto-clears). */
    showMiss(): boolean;
    subscribe(listener: () => void): () => void;
    set(active: boolean, name: string | null): void;
    setShowMiss(miss: boolean): void;
    /** Force idle so a torn-down placement can't wedge the prompt on. */
    reset(): void;
}
export declare const studioPlacementBannerStore: StudioPlacementBannerStore;
export {};
