"use strict";
/**
 * ViroMaterials
 *
 * A utility for creating and managing materials.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMaterials = registerMaterials;
exports.getMaterial = getMaterial;
exports.getAllMaterials = getAllMaterials;
exports.updateMaterial = updateMaterial;
exports.deleteMaterials = deleteMaterials;
const ViroGlobal_1 = require("../ViroGlobal");
// Material registry
const materials = {};
/**
 * Register materials with the Viro system.
 * @param materialMap A map of material names to material definitions.
 */
function registerMaterials(materialMap) {
    // Add materials to the registry
    Object.entries(materialMap).forEach(([name, definition]) => {
        materials[name] = definition;
        // Register with native code if available
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (nativeViro) {
            nativeViro.createViroMaterial(name, definition);
        }
    });
}
/**
 * Get a material by name.
 * @param name The name of the material.
 * @returns The material definition, or undefined if not found.
 */
function getMaterial(name) {
    return materials[name];
}
/**
 * Get all registered materials.
 * @returns A map of material names to material definitions.
 */
function getAllMaterials() {
    return { ...materials };
}
/**
 * Update a material.
 * @param name The name of the material to update.
 * @param definition The new material definition.
 */
function updateMaterial(name, definition) {
    // Update the registry
    materials[name] = { ...materials[name], ...definition };
    // Update native code if available
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.updateViroMaterial(name, definition);
    }
}
/**
 * Delete materials from the Viro system.
 * @param materialNames An array of material names to delete.
 */
function deleteMaterials(materialNames) {
    // Remove materials from the registry
    materialNames.forEach((name) => {
        delete materials[name];
    });
    // Note: In the Fabric implementation, there's no direct native method to delete materials
    // This implementation just removes them from the JS registry
    // If a native method becomes available in the future, it can be called here
    console.warn("ViroMaterials.deleteMaterials: Material deletion from native code is not supported in the Fabric implementation. " +
        "Materials are only removed from the JavaScript registry.");
}
// Export the materials object as the default export
const ViroMaterials = {
    registerMaterials,
    getMaterial,
    getAllMaterials,
    updateMaterial,
    deleteMaterials,
    // Add createMaterials as an alias for registerMaterials for backward compatibility
    createMaterials: registerMaterials,
};
exports.default = ViroMaterials;
