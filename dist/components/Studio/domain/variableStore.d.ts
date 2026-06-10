import { StudioSceneVariable } from "../types";
import { StudioVariableValue } from "./expressionEvaluator";
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
    get(name: string): StudioVariableValue | undefined;
    set(name: string, value: StudioVariableValue): void;
    seed(declarations: StudioSceneVariable[]): void;
    reset(): void;
    snapshot(): Record<string, StudioVariableValue>;
}
