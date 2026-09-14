"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webUnsupportedFeatures = webUnsupportedFeatures;
const placementStore_1 = require("./placementStore");
/** True for a config object that exists and is not explicitly switched off. */
function isEnabled(config) {
    if (typeof config !== "object" || config === null)
        return false;
    return config.enabled !== false;
}
function hasPhysics(world, assets) {
    // The scene switch gates every body, so a world that is off means nothing
    // would have simulated and there is nothing to warn about. Reporting it
    // anyway trains people to ignore the banner.
    const worldOn = typeof world === "object" &&
        world !== null &&
        world.enabled === true;
    return worldOn && assets.some((a) => isEnabled(a.physics_config));
}
function webUnsupportedFeatures(sceneData, 
/** "3d" has no camera to hit-test against, so guided placement cannot run. */
mode = "ar") {
    const { scene, assets } = sceneData;
    const features = [];
    // The node factory's marker assets are filtered out of the tree entirely.
    if (assets.some((a) => a.trigger_image_url))
        features.push("image markers");
    if (hasPhysics(scene.physics_world_config, assets))
        features.push("physics");
    // Only on-load and on-click reach a node on web: this host wires none of the
    // three bindings runtimes the native one does.
    if (sceneData.gaze_bindings?.length)
        features.push("gaze triggers");
    if (sceneData.proximity_bindings?.length)
        features.push("proximity triggers");
    if (sceneData.collision_bindings?.length)
        features.push("collision triggers");
    // Guided placement needs a tracked camera to hit-test a tap against, so it
    // runs in AR and nowhere else. In 3d the queue would never advance and the
    // assets would stay hidden for the whole scene.
    if (mode !== "ar" && assets.some(placementStore_1.isTapToPlaceAsset)) {
        features.push("tap to place");
    }
    if ((scene.plane_detection ?? "").toUpperCase() === "MANUAL") {
        features.push("manual plane selection");
    }
    return features;
}
