"use strict";
/**
 * ViroARTrackingTargets
 *
 * A utility for registering AR tracking targets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTargets = registerTargets;
exports.getTarget = getTarget;
exports.getAllTargets = getAllTargets;
exports.clearTargets = clearTargets;
exports.deleteTarget = deleteTarget;
const ViroGlobal_1 = require("../ViroGlobal");
// Tracking target registry
const targets = {};
/**
 * Register AR tracking targets with the Viro system.
 * @param targetMap A map of target names to target definitions.
 */
function registerTargets(targetMap) {
    // Add targets to the registry
    Object.entries(targetMap).forEach(([name, definition]) => {
        targets[name] = definition;
    });
    // Register with native code if available
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.setViroARImageTargets(targets);
    }
}
/**
 * Get a tracking target by name.
 * @param name The name of the tracking target.
 * @returns The tracking target definition, or undefined if not found.
 */
function getTarget(name) {
    return targets[name];
}
/**
 * Get all registered tracking targets.
 * @returns A map of tracking target names to tracking target definitions.
 */
function getAllTargets() {
    return { ...targets };
}
/**
 * Clear all registered tracking targets.
 */
function clearTargets() {
    // Clear the registry
    Object.keys(targets).forEach((key) => {
        delete targets[key];
    });
    // Clear native code if available
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.setViroARImageTargets({});
    }
}
/**
 * Delete a specific tracking target.
 * @param targetName The name of the tracking target to delete.
 */
function deleteTarget(targetName) {
    // Remove the target from the registry
    delete targets[targetName];
    // Update native code if available
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        // Since there's no direct method to delete a single target,
        // we re-register all remaining targets
        nativeViro.setViroARImageTargets(targets);
    }
}
// Export the tracking targets object as the default export
const ViroARTrackingTargets = {
    registerTargets,
    getTarget,
    getAllTargets,
    clearTargets,
    deleteTarget,
    // Add createTargets as an alias for registerTargets for backward compatibility
    createTargets: registerTargets,
};
exports.default = ViroARTrackingTargets;
