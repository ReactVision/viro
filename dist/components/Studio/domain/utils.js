"use strict";
// Small shared helpers for the Studio runtime domain.
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyedListeners = exports.GlobalListeners = exports.isDev = void 0;
/** True only in a dev build; gates verbose runtime logging in the Studio stores. */
const isDev = () => typeof __DEV__ !== "undefined" && __DEV__;
exports.isDev = isDev;
/** A set of subscribers notified together (variable + sound stores). */
class GlobalListeners {
    listeners = new Set();
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify() {
        // Snapshot first: a listener may (un)subscribe during its own callback.
        [...this.listeners].forEach((fn) => fn());
    }
}
exports.GlobalListeners = GlobalListeners;
/** Subscribers partitioned by key; notify(key) wakes only that key's set
 * (the visibility store's per-asset variant). */
class KeyedListeners {
    listeners = new Map();
    subscribe(key, listener) {
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
    notify(key) {
        // Snapshot first: a listener may (un)subscribe during its own callback.
        const set = this.listeners.get(key);
        if (set)
            [...set].forEach((fn) => fn());
    }
    notifyAll() {
        this.listeners.forEach((set) => [...set].forEach((fn) => fn()));
    }
}
exports.KeyedListeners = KeyedListeners;
