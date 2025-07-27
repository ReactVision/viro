/**
 * ViroAnimations
 *
 * A utility for creating and managing animations.
 */
export type ViroAnimationTimingFunction = "Linear" | "EaseIn" | "EaseOut" | "EaseInEaseOut" | "Bounce";
export interface ViroAnimationDefinition {
    properties: Record<string, any>;
    duration?: number;
    delay?: number;
    loop?: boolean;
    easing?: ViroAnimationTimingFunction;
}
/**
 * Register animations with the Viro system.
 * @param animationMap A map of animation names to animation definitions.
 */
export declare function registerAnimations(animationMap: Record<string, ViroAnimationDefinition>): void;
/**
 * Get an animation by name.
 * @param name The name of the animation.
 * @returns The animation definition, or undefined if not found.
 */
export declare function getAnimation(name: string): ViroAnimationDefinition | undefined;
/**
 * Get all registered animations.
 * @returns A map of animation names to animation definitions.
 */
export declare function getAllAnimations(): Record<string, ViroAnimationDefinition>;
/**
 * Execute an animation on a node.
 * @param nodeId The ID of the node to animate.
 * @param animationName The name of the animation to execute.
 * @param options Options for the animation execution.
 */
export declare function executeAnimation(nodeId: string, animationName: string, options?: {
    loop?: boolean;
    delay?: number;
    onStart?: () => void;
    onFinish?: () => void;
}): void;
declare const ViroAnimations: {
    registerAnimations: typeof registerAnimations;
    getAnimation: typeof getAnimation;
    getAllAnimations: typeof getAllAnimations;
    executeAnimation: typeof executeAnimation;
};
export default ViroAnimations;
