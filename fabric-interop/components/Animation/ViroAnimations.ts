/**
 * ViroAnimations
 *
 * A utility for creating and managing animations.
 */

import { getNativeViro } from "../ViroGlobal";

// Animation types
export type ViroAnimationTimingFunction =
  | "Linear"
  | "EaseIn"
  | "EaseOut"
  | "EaseInEaseOut"
  | "Bounce";

export interface ViroAnimationDefinition {
  properties: Record<string, any>;
  duration?: number;
  delay?: number;
  loop?: boolean;
  easing?: ViroAnimationTimingFunction;
}

// Animation registry
const animations: Record<string, ViroAnimationDefinition> = {};

/**
 * Register animations with the Viro system.
 * @param animationMap A map of animation names to animation definitions.
 */
export function registerAnimations(
  animationMap: Record<string, ViroAnimationDefinition>
): void {
  // Add animations to the registry
  Object.entries(animationMap).forEach(([name, definition]) => {
    animations[name] = definition;

    // Register with native code if available
    const nativeViro = getNativeViro();
    if (nativeViro) {
      nativeViro.createViroAnimation(name, definition);
    }
  });
}

/**
 * Get an animation by name.
 * @param name The name of the animation.
 * @returns The animation definition, or undefined if not found.
 */
export function getAnimation(
  name: string
): ViroAnimationDefinition | undefined {
  return animations[name];
}

/**
 * Get all registered animations.
 * @returns A map of animation names to animation definitions.
 */
export function getAllAnimations(): Record<string, ViroAnimationDefinition> {
  return { ...animations };
}

/**
 * Execute an animation on a node.
 * @param nodeId The ID of the node to animate.
 * @param animationName The name of the animation to execute.
 * @param options Options for the animation execution.
 */
export function executeAnimation(
  nodeId: string,
  animationName: string,
  options: {
    loop?: boolean;
    delay?: number;
    onStart?: () => void;
    onFinish?: () => void;
  } = {}
): void {
  const nativeViro = getNativeViro();
  if (!nativeViro) return;

  nativeViro.executeViroAnimation(nodeId, animationName, options);
}

// Export the animations object as the default export
const ViroAnimations = {
  registerAnimations,
  getAnimation,
  getAllAnimations,
  executeAnimation,
};

export default ViroAnimations;
