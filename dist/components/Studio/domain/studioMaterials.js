"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStudioMaterialsForAssets = registerStudioMaterialsForAssets;
const ViroMaterials_1 = require("../../Material/ViroMaterials");
const materialConfig_1 = require("./materialConfig");
/**
 * Registers Viro materials for scene assets that have a valid `material_config`.
 * Call synchronously after fetching assets and before rendering AR nodes.
 */
function registerStudioMaterialsForAssets(assets) {
    const materials = {};
    for (const asset of assets) {
        if (asset.asset_type_name !== "3D-MODEL")
            continue;
        if (asset.material_config == null)
            continue;
        const config = (0, materialConfig_1.parseMaterialConfig)(asset.material_config);
        if (!config)
            continue;
        materials[(0, materialConfig_1.studioMaterialName)(asset.id)] = (0, materialConfig_1.buildViroMaterialDefinition)(config);
    }
    if (Object.keys(materials).length === 0)
        return;
    try {
        ViroMaterials_1.ViroMaterials.createMaterials(materials);
    }
    catch (err) {
        console.error("[studioMaterials] ViroMaterials.createMaterials failed", err);
    }
}
