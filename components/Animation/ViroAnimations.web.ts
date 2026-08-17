/**
 * Web implementation of ViroAnimations. Instead of registering declarative
 * animations with the native module, it stores them in the web animation
 * registry, where node components resolve them by name and run a transaction.
 */
import { registerViroAnimations } from "../Web/viroAnimationRegistry";

export type {
  ViroRegisterableAnimation,
  ViroAnimationDict,
  ViroAnimationChainDict,
  ViroAnimationProp,
  ViroAnimation,
} from "./ViroAnimations";

export class ViroAnimations {
  static registerAnimations(animations: Record<string, any>) {
    // Animation chains (arrays) are not supported on web yet; register single defs.
    const singles: Record<string, any> = {};
    for (const name of Object.keys(animations)) {
      const def = animations[name];
      if (!Array.isArray(def)) singles[name] = def;
    }
    registerViroAnimations(singles);
  }
}
