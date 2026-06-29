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
