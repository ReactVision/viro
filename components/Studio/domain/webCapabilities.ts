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
import type { StudioAsset, StudioSceneResponse } from "../types";
import { isTapToPlaceAsset } from "./placementStore";

/** True for a config object that exists and is not explicitly switched off. */
function isEnabled(config: unknown): boolean {
  if (typeof config !== "object" || config === null) return false;
  return (config as { enabled?: boolean }).enabled !== false;
}

function hasPhysics(
  world: unknown,
  assets: readonly StudioAsset[],
): boolean {
  // The scene switch gates every body, so a world that is off means nothing
  // would have simulated and there is nothing to warn about. Reporting it
  // anyway trains people to ignore the banner.
  const worldOn =
    typeof world === "object" &&
    world !== null &&
    (world as { enabled?: boolean }).enabled === true;
  return worldOn && assets.some((a) => isEnabled(a.physics_config));
}

export function webUnsupportedFeatures(
  sceneData: StudioSceneResponse,
): string[] {
  const { scene, assets } = sceneData;
  const features: string[] = [];

  // The node factory's marker assets are filtered out of the tree entirely.
  if (assets.some((a) => a.trigger_image_url)) features.push("image markers");

  if (hasPhysics(scene.physics_world_config, assets)) features.push("physics");

  // Only on-load and on-click reach a node on web: this host wires none of the
  // three bindings runtimes the native one does.
  if (sceneData.gaze_bindings?.length) features.push("gaze triggers");
  if (sceneData.proximity_bindings?.length) features.push("proximity triggers");
  if (sceneData.collision_bindings?.length) features.push("collision triggers");

  // With no placement store in the runtime context, the factory mounts these at
  // once and at the raw author offset — which is an offset from a tap point that
  // never happens, so they land on top of the camera.
  if (assets.some(isTapToPlaceAsset)) features.push("tap to place");

  if (((scene.plane_detection as string) ?? "").toUpperCase() === "MANUAL") {
    features.push("manual plane selection");
  }

  return features;
}
