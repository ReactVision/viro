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
    get(name) {
        return this.values.get(name);
    }
    set(name, value) {
        this.values.set(name, value);
        if (isDev()) {
            console.log(`[Studio] Variable "${name}" =`, value);
        }
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
