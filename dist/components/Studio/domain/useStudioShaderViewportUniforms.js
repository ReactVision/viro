"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioShaderViewportUniforms = useStudioShaderViewportUniforms;
const react_1 = require("react");
const react_native_1 = require("react-native");
const ViroMaterials_1 = require("../../Material/ViroMaterials");
const materialConfig_1 = require("./materialConfig");
function computeViewportPayload(assets) {
    const names = [];
    for (const asset of assets) {
        if (asset.asset_type_name !== "3D-MODEL")
            continue;
        if (asset.material_config == null)
            continue;
        const config = (0, materialConfig_1.parseMaterialConfig)(asset.material_config);
        if (!config || !(0, materialConfig_1.materialConfigNeedsViewportUniforms)(config))
            continue;
        names.push((0, materialConfig_1.studioMaterialName)(asset.id));
    }
    names.sort();
    return { key: names.join("|"), names };
}
/**
 * Pushes _rf_vpw / _rf_vph (physical pixel dimensions) to materials that sample the camera
 * feed via gl_FragCoord. Called on mount and whenever the screen dimensions change.
 */
function useStudioShaderViewportUniforms(assets) {
    const payload = (0, react_1.useMemo)(() => computeViewportPayload(assets), [assets]);
    const pushViewport = (0, react_1.useCallback)(() => {
        if (payload.names.length === 0)
            return;
        const { width, height } = react_native_1.Dimensions.get("screen");
        const pr = react_native_1.PixelRatio.get();
        const pw = width * pr;
        const ph = height * pr;
        for (const name of payload.names) {
            ViroMaterials_1.ViroMaterials.updateShaderUniform(name, "_rf_vpw", "float", pw);
            ViroMaterials_1.ViroMaterials.updateShaderUniform(name, "_rf_vph", "float", ph);
        }
    }, [payload]);
    (0, react_1.useEffect)(() => {
        if (payload.names.length === 0)
            return;
        pushViewport();
        const sub = react_native_1.Dimensions.addEventListener("change", pushViewport);
        return () => sub.remove();
    }, [payload.key, pushViewport]);
}
