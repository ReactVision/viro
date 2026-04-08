import { ViroARTrackingTargets } from "../../AR/ViroARTrackingTargets";
import { StudioAsset } from "../types";

const DEFAULT_PHYSICAL_WIDTH = 0.2; // meters
const DEFAULT_ORIENTATION = "Up" as const;

/**
 * Registers trigger image targets with ViroReact for image recognition.
 * One target per asset with trigger_image_url.
 * Must be called before rendering ViroARImageMarker components.
 *
 * @returns Map from trigger_image_url → target name for lookup in ViroARImageMarker
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

  const urlToTargetName = new Map<string, string>();
  const targets: Record<
    string,
    {
      source: { uri: string };
      orientation: string;
      physicalWidth: number;
      type: string;
    }
  > = {};

  assetsWithTrigger.forEach((asset, index) => {
    const targetName = `studio-trigger-${index}`;
    urlToTargetName.set(asset.trigger_image_url, targetName);
    targets[targetName] = {
      source: { uri: asset.trigger_image_url },
      orientation: asset.trigger_image_orientation ?? DEFAULT_ORIENTATION,
      physicalWidth:
        asset.trigger_image_physical_width_m ?? DEFAULT_PHYSICAL_WIDTH,
      type: "Image",
    };
  });

  ViroARTrackingTargets.createTargets(targets);
  return urlToTargetName;
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
