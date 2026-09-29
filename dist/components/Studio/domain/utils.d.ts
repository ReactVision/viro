/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
export declare const isDev: () => boolean;
/** A set of subscribers notified together (variable + sound stores). */
export declare class GlobalListeners {
    private listeners;
    subscribe(listener: () => void): () => void;
    notify(): void;
}
/** Subscribers partitioned by key; notify(key) wakes only that key's set
 * (the visibility store's per-asset variant). */
export declare class KeyedListeners {
    private listeners;
    subscribe(key: string, listener: () => void): () => void;
    notify(key: string): void;
    notifyAll(): void;
}
/**
 * Who made a store change: this device, or a shared session applying another
 * device's. A shared session writes only local changes, so applying a remote
 * one never echoes back to the room.
 */
export type StudioChangeOrigin = "local" | "remote";
/**
 * Who caused a sound or an animation. `device` is this device alone: what
 * caused it runs on every device, so a shared session does not repeat it.
 */
export type StudioEffectOrigin = StudioChangeOrigin | "device";
/** `key` is null when every key changed at once (a reseed or a reset). */
export type StudioStoreChangeListener = (key: string | null, origin: StudioChangeOrigin) => void;
export declare class ChangeListeners {
    private listeners;
    subscribe(listener: StudioStoreChangeListener): () => void;
    notify(key: string | null, origin: StudioChangeOrigin): void;
}
