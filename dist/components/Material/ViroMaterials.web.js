"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterials = void 0;
/**
 * Web implementation of ViroMaterials. Instead of pushing material definitions
 * to the native VRTMaterialManager, it stores them in the web material registry,
 * where node components resolve them by name and build materials via the C API.
 *
 * Supports diffuseColor, lightingModel, scalar properties, PBR textures,
 * shaderModifiers, updateShaderUniform, and deleteMaterials (parsed/dispatched
 * the same way as MaterialManager.java's native bridge — see
 * viroMaterialRegistry.ts).
 */
const viroMaterialRegistry_1 = require("../Web/viroMaterialRegistry");
class ViroMaterials {
    static createMaterials(materials) {
        (0, viroMaterialRegistry_1.registerViroMaterials)(materials);
    }
    static deleteMaterials(materials) {
        (0, viroMaterialRegistry_1.deleteViroMaterials)(materials);
    }
    static updateShaderUniform(materialName, uniformName, uniformType, value) {
        (0, viroMaterialRegistry_1.updateMaterialShaderUniform)(materialName, uniformName, uniformType, value);
    }
}
exports.ViroMaterials = ViroMaterials;
