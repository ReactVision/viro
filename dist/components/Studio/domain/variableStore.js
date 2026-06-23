"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioVariableStore = void 0;
const expressionEvaluator_1 = require("./expressionEvaluator");
const isDev = () => typeof __DEV__ !== "undefined" && __DEV__;
/**
 * Per-session variable store. One instance is owned by the navigator and
 * survives scene pushes; it resets only when the AR/VR session ends.
 *
 * Identity is by NAME: scenes declaring the same name share one value, and
 * seed() only initialises names not already present (initialize-if-absent),
 * so values carry across scene transitions.
 */
class StudioVariableStore {
    values = new Map();
    listeners = new Set();
    get(name) {
        return this.values.get(name);
    }
    /**
     * Subscribe to value changes (set/reset); returns an unsubscribe fn. Reactive
     * TEXT nodes use this to repaint when a referenced variable changes.
     */
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
    set(name, value) {
        // Values are primitives; skip the no-op write so unchanged values don't
        // log or wake subscribers.
        if (Object.is(this.values.get(name), value))
            return;
        this.values.set(name, value);
        if (isDev()) {
            console.log(`[Studio] Variable "${name}" =`, value);
        }
        this.notify();
    }
    seed(declarations) {
        for (const decl of declarations) {
            if (!decl?.name)
                continue;
            if (!(0, expressionEvaluator_1.valueMatchesType)(decl.initial_value, decl.type)) {
                console.warn(`[Studio] Variable "${decl.name}": initial value does not match type ${decl.type}; skipping seed.`);
                continue;
            }
            const existing = this.values.get(decl.name);
            if (existing !== undefined) {
                if (!(0, expressionEvaluator_1.valueMatchesType)(existing, decl.type)) {
                    console.warn(`[Studio] Variable "${decl.name}" already holds a ${typeof existing} this session, but this scene declares ${decl.type}; keeping the existing value.`);
                }
                continue;
            }
            this.values.set(decl.name, decl.initial_value);
        }
    }
    reset() {
        this.values.clear();
        this.notify();
    }
    snapshot() {
        const out = {};
        this.values.forEach((value, name) => {
            out[name] = value;
        });
        return out;
    }
}
exports.StudioVariableStore = StudioVariableStore;
