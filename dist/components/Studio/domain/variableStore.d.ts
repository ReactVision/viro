import { StudioSceneVariable } from "../types";
import { StudioVariableValue } from "./expressionEvaluator";
import { type StudioChangeOrigin, type StudioStoreChangeListener } from "./utils";
/**
 * Per-session variable store. One instance is owned by the navigator and
 * survives scene pushes; it resets only when the AR/VR session ends.
 *
 * Identity is by NAME: scenes declaring the same name share one value, and
 * seed() only initialises names not already present (initialize-if-absent),
 * so values carry across scene transitions.
 */
export declare class StudioVariableStore {
    private values;
    private listeners;
    private changes;
    get(name: string): StudioVariableValue | undefined;
    /** Subscribe to value changes (set/reset); returns an unsubscribe fn. */
    subscribe(listener: () => void): () => void;
    /** Each change with the variable's name (null after reset) and its origin. */
    subscribeChanges(listener: StudioStoreChangeListener): () => void;
    set(name: string, value: StudioVariableValue, origin?: StudioChangeOrigin): void;
    seed(declarations: StudioSceneVariable[]): void;
    reset(): void;
    snapshot(): Record<string, StudioVariableValue>;
}
