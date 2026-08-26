"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroLightingEnvironment = ViroLightingEnvironment;
/**
 * Web implementation of ViroLightingEnvironment — applies an HDR image-based
 * lighting environment to the scene (diffuse irradiance + specular reflections
 * for PBR materials). Scene-level (renders no node).
 *
 * `source` must be a radiance `.hdr` (equirectangular). The renderer fetches it,
 * writes it to the WASM FS, and loads it via VROHDRLoader.
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function ViroLightingEnvironment(props) {
    const renderer = (0, ViroWebContext_1.useViroRenderer)();
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    (0, react_1.useEffect)(() => {
        if (!url)
            return;
        let cancelled = false;
        renderer
            .loadLightingEnvironment(url)
            .then((handle) => {
            if (cancelled)
                return;
            if (handle)
                props.onLoadEnd?.();
            else
                props.onError?.(new Error(`failed to load HDR environment: ${url}`));
        })
            .catch((err) => {
            if (!cancelled)
                props.onError?.(err);
        });
        return () => {
            cancelled = true;
            renderer.clearLightingEnvironment();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
    return null;
}
