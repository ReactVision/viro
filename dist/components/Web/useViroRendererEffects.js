"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroRendererEffects = useViroRendererEffects;
/**
 * The four post-processing effects, as scene-navigator props.
 *
 * The native scene navigators expose exactly these four and default them all on
 * (VRTARSceneNavigator's init), and web's renderer opens the same way. Until
 * this existed web had no way to turn them off, so a caller that switches HDR
 * and bloom off on a device — as Studio does — got them anyway in a browser,
 * and web was the only one of the three surfaces still tone-mapping.
 *
 * Applied after the renderer exists rather than at construction, because that is
 * when a prop change can also reach it, and it is what the native setters do.
 */
const react_1 = require("react");
function useViroRendererEffects(renderer, { hdrEnabled, bloomEnabled, pbrEnabled, shadowsEnabled }) {
    (0, react_1.useEffect)(() => {
        if (!renderer)
            return;
        const scene = renderer.scene;
        // Each is left alone when its prop is absent, so an undeclared effect keeps
        // whatever the renderer opened with instead of being forced to a default
        // this hook invented.
        if (hdrEnabled !== undefined)
            scene.setHDREnabled(hdrEnabled);
        if (bloomEnabled !== undefined)
            scene.setBloomEnabled(bloomEnabled);
        if (pbrEnabled !== undefined)
            scene.setPBREnabled(pbrEnabled);
        if (shadowsEnabled !== undefined)
            scene.setShadowsEnabled(shadowsEnabled);
    }, [renderer, hdrEnabled, bloomEnabled, pbrEnabled, shadowsEnabled]);
}
