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
function webUnsupportedFeatures(sceneData) {
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
    // With no placement store in the runtime context, the factory mounts these at
    // once and at the raw author offset — which is an offset from a tap point that
    // never happens, so they land on top of the camera.
    if (assets.some(placementStore_1.isTapToPlaceAsset))
        features.push("tap to place");
    if ((scene.plane_detection ?? "").toUpperCase() === "MANUAL") {
        features.push("manual plane selection");
    }
    return features;
}
