// Small shared helpers for the Studio runtime domain.

/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
export const isDev = (): boolean =>
  typeof __DEV__ !== "undefined" && __DEV__;

/** A set of subscribers notified together (variable + sound stores). */
export class GlobalListeners {
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(): void {
    // Snapshot first: a listener may (un)subscribe during its own callback.
    [...this.listeners].forEach((fn) => fn());
  }
}

/** Subscribers partitioned by key; notify(key) wakes only that key's set
 * (the visibility store's per-asset variant). */
export class KeyedListeners {
  private listeners = new Map<string, Set<() => void>>();

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  notify(key: string): void {
    // Snapshot first: a listener may (un)subscribe during its own callback.
    const set = this.listeners.get(key);
    if (set) [...set].forEach((fn) => fn());
  }

  notifyAll(): void {
    this.listeners.forEach((set) => [...set].forEach((fn) => fn()));
  }
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
export type StudioStoreChangeListener = (
  key: string | null,
  origin: StudioChangeOrigin
) => void;

export class ChangeListeners {
  private listeners = new Set<StudioStoreChangeListener>();

  subscribe(listener: StudioStoreChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(key: string | null, origin: StudioChangeOrigin): void {
    [...this.listeners].forEach((fn) => fn(key, origin));
  }
}
