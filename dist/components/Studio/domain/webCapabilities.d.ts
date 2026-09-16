/**
 * What a scene asks for that the web host cannot draw or run.
 *
 * `StudioARScene.web` reports this through `onUnsupported` so the caller can put
 * a banner over the scene, and Studio's publish flow warns against the same
 * list. It only earns that if it is complete: a gap that is not listed here
 * reaches the viewer as a scene that opens correctly and then does nothing,
 * which reads as a bug in the content rather than a limit of the surface.
 *
 * Each entry is a feature the host actively drops, not one it renders
 * differently. Approximations belong in the component that makes them.
 */
import type { StudioSceneResponse } from "../types";
/**
 * Whether the host wraps the scene's assets in a ViroARPlane.
 *
 * It decides more than anchoring: inside a wrapper an asset's authored position
 * is plane-local, and the web C API cannot read a node's world transform, so
 * anything measuring real distances only works outside one.
 */
export declare function usesPlaneWrapper(planeDetection: string | null | undefined, mode: "ar" | "3d"): boolean;
export declare function webUnsupportedFeatures(sceneData: StudioSceneResponse, 
/** "3d" has no camera to hit-test against, so guided placement cannot run. */
mode?: "ar" | "3d"): string[];
