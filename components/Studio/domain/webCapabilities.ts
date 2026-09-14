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

/**
 * Whether the host wraps the scene's assets in a ViroARPlane.
 *
 * It decides more than anchoring: inside a wrapper an asset's authored position
 * is plane-local, and the web C API cannot read a node's world transform, so
 * anything measuring real distances only works outside one.
 */
export function usesPlaneWrapper(
  planeDetection: string | null | undefined,
  mode: "ar" | "3d",
): boolean {
  if (mode !== "ar") return false;
  const detection = (planeDetection ?? "NONE").toUpperCase();
  return detection === "AUTOMATIC" || detection === "MANUAL";
}

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
  /** "3d" has no camera to hit-test against, so guided placement cannot run. */
  mode: "ar" | "3d" = "ar",
): string[] {
  const { scene, assets } = sceneData;
  const features: string[] = [];

  // The node factory's marker assets are filtered out of the tree entirely.
  if (assets.some((a) => a.trigger_image_url)) features.push("image markers");

  if (hasPhysics(scene.physics_world_config, assets)) features.push("physics");

  // Gaze is a headset affordance: the native host wires it on Quest only, and a
  // browser has no gaze ray either. Standing a mouse hover in for it would give
  // web a behaviour no phone has, which is the opposite of parity.
  if (sceneData.gaze_bindings?.length) features.push("gaze triggers");

  // Proximity measures the distance from the camera to an asset, so it needs the
  // asset's world position. Inside a plane wrapper the authored position is
  // plane-local and the web C API cannot read a world transform, so the metres
  // would be wrong — better declared than quietly off.
  if (
    sceneData.proximity_bindings?.length &&
    usesPlaneWrapper(scene.plane_detection as string, mode)
  ) {
    features.push("proximity triggers");
  }

  // Collisions need a physics world, which web has none of.
  if (sceneData.collision_bindings?.length) features.push("collision triggers");

  // Guided placement needs a tracked camera to hit-test a tap against, so it
  // runs in AR and nowhere else. In 3d the queue would never advance and the
  // assets would stay hidden for the whole scene.
  if (mode !== "ar" && assets.some(isTapToPlaceAsset)) {
    features.push("tap to place");
  }

  if (((scene.plane_detection as string) ?? "").toUpperCase() === "MANUAL") {
    features.push("manual plane selection");
  }

  return features;
}
