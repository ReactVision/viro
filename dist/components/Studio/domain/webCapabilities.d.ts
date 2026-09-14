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
export declare function webUnsupportedFeatures(sceneData: StudioSceneResponse, 
/** "3d" has no camera to hit-test against, so guided placement cannot run. */
mode?: "ar" | "3d"): string[];
