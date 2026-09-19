"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroToneMapping = useViroToneMapping;
/**
 * Scene-level tone curve, shared by ViroScene.web and ViroARScene.web.
 *
 * It exists apart from the navigator's HDR prop because the two are not
 * interchangeable: virocore's isPBREnabled() is `_hdrEnabled && _pbrEnabled`, so
 * a caller who switches HDR off to be rid of Hable's curve also switches off the
 * whole PBR branch of VROShaderFactory — roughness, metalness and the AO map
 * stop being read and a glTF material falls back to Blinn, whose default
 * specular renders the model white. That is exactly what Studio did on web while
 * native kept HDR on and switched the curve off here.
 *
 * Undefined leaves the scene as built, which is the curve on.
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./ViroWebContext");
function useViroToneMapping(enabled) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    (0, react_1.useEffect)(() => {
        if (!scene || enabled === undefined)
            return;
        scene.setToneMappingEnabled(enabled);
    }, [scene, enabled]);
}
