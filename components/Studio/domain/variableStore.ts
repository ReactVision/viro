import { StudioSceneVariable } from "../types";
import {
  StudioVariableValue,
  valueMatchesType,
} from "./expressionEvaluator";

const isDev = (): boolean => typeof __DEV__ !== "undefined" && __DEV__;

/**
 * Per-session variable store. One instance is owned by the navigator and
 * survives scene pushes; it resets only when the AR/VR session ends.
 *
 * Identity is by NAME: scenes declaring the same name share one value, and
 * seed() only initialises names not already present (initialize-if-absent),
 * so values carry across scene transitions.
 */
export class StudioVariableStore {
  private values = new Map<string, StudioVariableValue>();

  get(name: string): StudioVariableValue | undefined {
    return this.values.get(name);
  }

  set(name: string, value: StudioVariableValue): void {
    this.values.set(name, value);
    if (isDev()) {
      console.log(`[Studio] Variable "${name}" =`, value);
    }
  }

  seed(declarations: StudioSceneVariable[]): void {
    for (const decl of declarations) {
      if (!decl?.name) continue;
      if (!valueMatchesType(decl.initial_value, decl.type)) {
        console.warn(
          `[Studio] Variable "${decl.name}": initial value does not match type ${decl.type}; skipping seed.`
        );
        continue;
      }
      const existing = this.values.get(decl.name);
      if (existing !== undefined) {
        if (!valueMatchesType(existing, decl.type)) {
          console.warn(
            `[Studio] Variable "${decl.name}" already holds a ${typeof existing} this session, but this scene declares ${decl.type}; keeping the existing value.`
          );
        }
        continue;
      }
      this.values.set(decl.name, decl.initial_value);
    }
  }

  reset(): void {
    this.values.clear();
  }

  snapshot(): Record<string, StudioVariableValue> {
    const out: Record<string, StudioVariableValue> = {};
    this.values.forEach((value, name) => {
      out[name] = value;
    });
    return out;
  }
}
