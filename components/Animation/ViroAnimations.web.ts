/**
 * Web implementation of ViroAnimations. Instead of registering declarative
 * animations with the native module, it stores them in the web animation
 * registry, where node components resolve them by name and run a transaction.
 */
import { registerViroAnimations } from "../Web/viroAnimationRegistry";

export type {
  ViroRegisterableAnimation,
  ViroAnimationDict,
  ViroAnimationChain,
  ViroAnimationChainDict,
  ViroAnimationProp,
  ViroAnimation,
} from "./ViroAnimations";

export class ViroAnimations {
  static registerAnimations(animations: Record<string, any>) {
    registerViroAnimations(animations);
  }
}
