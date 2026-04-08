import { StudioAnimation } from "../types";
/**
 * Builds the Viro animation registry object from StudioAnimation rows.
 * The properties field is already in Viro's native keyframe format.
 */
export declare function buildViroAnimationRegistry(animations: StudioAnimation[]): Record<string, unknown>;
/**
 * Registers all scene animations with ViroReact.
 * Must be called before any animated Viro components mount.
 */
export declare function registerSceneAnimations(animations: StudioAnimation[]): void;
