import { ViroARTrackingTargets } from "../../AR/ViroARTrackingTargets";
import { StudioAsset } from "../types";

const DEFAULT_PHYSICAL_WIDTH = 0.2; // meters
const DEFAULT_ORIENTATION = "Up" as const;

type TriggerTarget = {
  source: { uri: string };
  orientation: string;
  physicalWidth: number;
  type: string;
};

/**
 * Registers image tracking targets and returns the asset id -> target name map
 * the ViroARImageMarkers mount against. Must be called before rendering them.
 *
 * Placements asking for the same picture at the same orientation and physical
 * width share one target, where this used to register one per placement and
 * hand every marker the last name it had generated. Both halves of that were
 * wrong: the extra targets each downloaded and decoded their own copy of the
 * image and no marker could reach them, and pointing several markers at one
 * target renders only one of them, since the renderer attaches a detected
 * anchor to a single marker node and leaves the rest waiting for an anchor that
 * never comes. Orientation and physical width stay part of the key rather than
 * being folded away: they describe how the file relates to the print, so two
 * placements that disagree are asking for two reference images, and the caller
 * groups its markers by target name to put the sharers on one.
 */
export function registerTriggerImageTargets(
  assets: StudioAsset[]
): Map<string, string> {
  const assetsWithTrigger = assets.filter(
    (a): a is StudioAsset & { trigger_image_url: string } =>
      !!a.trigger_image_url
  );

  if (assetsWithTrigger.length === 0) {
    return new Map();
  }

  const targetNameByAssetId = new Map<string, string>();
  const nameByTarget = new Map<string, string>();
  const targets: Record<string, TriggerTarget> = {};

  for (const asset of assetsWithTrigger) {
    const orientation = asset.trigger_image_orientation ?? DEFAULT_ORIENTATION;
    const physicalWidth =
      asset.trigger_image_physical_width_m ?? DEFAULT_PHYSICAL_WIDTH;
    const key = `${orientation}|${physicalWidth}|${asset.trigger_image_url}`;

    let targetName = nameByTarget.get(key);
    if (!targetName) {
      targetName = `studio-trigger-${nameByTarget.size}`;
      nameByTarget.set(key, targetName);
      targets[targetName] = {
        source: { uri: asset.trigger_image_url },
        orientation,
        physicalWidth,
        type: "Image",
      };
    }
    targetNameByAssetId.set(asset.id, targetName);
  }

  ViroARTrackingTargets.createTargets(targets);
  return targetNameByAssetId;
}

/**
 * Cleans up trigger image targets when the scene unmounts.
 */
export function cleanupTriggerImageTargets(targetNames: string[]): void {
  targetNames.forEach((name) => {
    try {
      ViroARTrackingTargets.deleteTarget(name);
    } catch (error) {
      console.warn(`[Studio] Failed to delete trigger target "${name}":`, error);
    }
  });
}
