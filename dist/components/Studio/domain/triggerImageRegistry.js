"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTriggerImageTargets = registerTriggerImageTargets;
exports.cleanupTriggerImageTargets = cleanupTriggerImageTargets;
const ViroARTrackingTargets_1 = require("../../AR/ViroARTrackingTargets");
const DEFAULT_PHYSICAL_WIDTH = 0.2; // meters
const DEFAULT_ORIENTATION = "Up";
/**
 * Registers trigger image targets with ViroReact for image recognition.
 * One target per asset with trigger_image_url.
 * Must be called before rendering ViroARImageMarker components.
 *
 * @returns Map from trigger_image_url → target name for lookup in ViroARImageMarker
 */
function registerTriggerImageTargets(assets) {
    const assetsWithTrigger = assets.filter((a) => !!a.trigger_image_url);
    if (assetsWithTrigger.length === 0) {
        return new Map();
    }
    const urlToTargetName = new Map();
    const targets = {};
    assetsWithTrigger.forEach((asset, index) => {
        const targetName = `studio-trigger-${index}`;
        urlToTargetName.set(asset.trigger_image_url, targetName);
        targets[targetName] = {
            source: { uri: asset.trigger_image_url },
            orientation: asset.trigger_image_orientation ?? DEFAULT_ORIENTATION,
            physicalWidth: asset.trigger_image_physical_width_m ?? DEFAULT_PHYSICAL_WIDTH,
            type: "Image",
        };
    });
    ViroARTrackingTargets_1.ViroARTrackingTargets.createTargets(targets);
    return urlToTargetName;
}
/**
 * Cleans up trigger image targets when the scene unmounts.
 */
function cleanupTriggerImageTargets(targetNames) {
    targetNames.forEach((name) => {
        try {
            ViroARTrackingTargets_1.ViroARTrackingTargets.deleteTarget(name);
        }
        catch (error) {
            console.warn(`[Studio] Failed to delete trigger target "${name}":`, error);
        }
    });
}
