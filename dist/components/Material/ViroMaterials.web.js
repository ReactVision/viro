"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterials = void 0;
/**
 * Web implementation of ViroMaterials. Instead of pushing material definitions
 * to the native VRTMaterialManager, it stores them in the web material registry,
 * where node components resolve them by name and build materials via the C API.
 *
 * MVP scope: diffuseColor + lightingModel. Textures/PBR maps/shader modifiers
 * are accepted but currently ignored on web.
 */
const viroMaterialRegistry_1 = require("../Web/viroMaterialRegistry");
class ViroMaterials {
    static createMaterials(materials) {
        (0, viroMaterialRegistry_1.registerViroMaterials)(materials);
    }
    // Not yet implemented on web; accepted as no-ops so shared code doesn't break.
    static deleteMaterials(_materials) { }
    static updateShaderUniform(_material, _uniform, _value) { }
}
exports.ViroMaterials = ViroMaterials;
