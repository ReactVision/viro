"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioShaderTimeUniforms = useStudioShaderTimeUniforms;
const react_1 = require("react");
const ViroMaterials_1 = require("../../Material/ViroMaterials");
const materialConfig_1 = require("./materialConfig");
/** ~60fps — matches Viro starter kit / shader docs. */
const TIME_TICK_MS = 16;
function computeTimeUniformPayload(assets) {
    const names = [];
    for (const asset of assets) {
        if (asset.asset_type_name !== "3D-MODEL")
            continue;
        if (asset.material_config == null)
            continue;
        const config = (0, materialConfig_1.parseMaterialConfig)(asset.material_config);
        if (!config || !(0, materialConfig_1.materialConfigNeedsTimeUniform)(config))
            continue;
        names.push((0, materialConfig_1.studioMaterialName)(asset.id));
    }
    names.sort();
    return { key: names.join("|"), names };
}
/**
 * Drives the `time` shader uniform for materials that use animated presets.
 * Uses `setInterval(16)` and `Date.now() % 1000000` like working Viro starter kits.
 */
function useStudioShaderTimeUniforms(assets) {
    const payload = (0, react_1.useMemo)(() => computeTimeUniformPayload(assets), [assets]);
    const payloadRef = (0, react_1.useRef)(payload);
    payloadRef.current = payload;
    const applyTimeUniforms = (0, react_1.useCallback)(() => {
        const { names } = payloadRef.current;
        if (names.length === 0)
            return;
        const time = Date.now() % 1_000_000;
        for (const name of names) {
            ViroMaterials_1.ViroMaterials.updateShaderUniform(name, "time", "float", time);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        if (payload.names.length === 0)
            return;
        const id = setInterval(applyTimeUniforms, TIME_TICK_MS);
        applyTimeUniforms();
        return () => clearInterval(id);
    }, [payload.key, applyTimeUniforms]);
}
