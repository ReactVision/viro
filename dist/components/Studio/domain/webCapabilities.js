"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usesPlaneWrapper = usesPlaneWrapper;
exports.webUnsupportedFeatures = webUnsupportedFeatures;
const placementStore_1 = require("./placementStore");
/**
 * Whether the host wraps the scene's assets in a ViroARPlane.
 *
 * It decides more than anchoring: inside a wrapper an asset's authored position
 * is plane-local, and the web C API cannot read a node's world transform, so
 * anything measuring real distances only works outside one.
 */
function usesPlaneWrapper(planeDetection, mode) {
    if (mode !== "ar")
        return false;
    const detection = (planeDetection ?? "NONE").toUpperCase();
    return detection === "AUTOMATIC" || detection === "MANUAL";
}
function webUnsupportedFeatures(sceneData, 
/** "3d" has no camera to hit-test against, so guided placement cannot run. */
mode = "ar") {
    const { scene, assets } = sceneData;
    const features = [];
    // The node factory's marker assets are filtered out of the tree entirely.
    if (assets.some((a) => a.trigger_image_url))
        features.push("image markers");
    // Physics runs on web now: Bullet is in the binary and the host drives it.
    // Gaze is a headset affordance: the native host wires it on Quest only, and a
    // browser has no gaze ray either. Standing a mouse hover in for it would give
    // web a behaviour no phone has, which is the opposite of parity.
    if (sceneData.gaze_bindings?.length)
        features.push("gaze triggers");
    // Proximity measures the distance from the camera to an asset, so it needs the
    // asset's world position. Inside a plane wrapper the authored position is
    // plane-local and the web C API cannot read a world transform, so the metres
    // would be wrong — better declared than quietly off.
    if (sceneData.proximity_bindings?.length &&
        usesPlaneWrapper(scene.plane_detection, mode)) {
        features.push("proximity triggers");
    }
    // Collision triggers ride the physics world, so they run wherever it does.
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
