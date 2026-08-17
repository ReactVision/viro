"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSkyBox = ViroSkyBox;
/**
 * Web implementation of ViroSkyBox — sets the scene background to a cube map
 * from six images (`source` = { px, nx, py, ny, pz, nz }). Scene-level (renders
 * no node). Falls back to nothing if any face fails to load.
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
const FACE_ORDER = ["px", "nx", "py", "ny", "pz", "nz"];
function ViroSkyBox(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const src = props.source;
    const key = src ? FACE_ORDER.map((f) => (0, viroImageLoader_1.resolveImageSource)(src[f]) ?? "").join("|") : "";
    (0, react_1.useEffect)(() => {
        if (!src)
            return;
        const urls = FACE_ORDER.map((f) => (0, viroImageLoader_1.resolveImageSource)(src[f]));
        if (urls.some((u) => !u))
            return;
        let cancelled = false;
        let texture = 0;
        Promise.all(urls.map((u) => (0, viroImageLoader_1.loadImageRGBA)(u)))
            .then((faces) => {
            if (cancelled)
                return;
            const { width, height } = faces[0];
            texture = scene.createTextureCubeRGBA({
                px: faces[0].pixels,
                nx: faces[1].pixels,
                py: faces[2].pixels,
                ny: faces[3].pixels,
                pz: faces[4].pixels,
                nz: faces[5].pixels,
            }, width, height);
            scene.setBackgroundCube(texture);
            props.onLoadEnd?.();
        })
            .catch((err) => {
            if (!cancelled)
                props.onError?.(err);
        });
        return () => {
            cancelled = true;
            if (texture)
                scene.destroyTexture(texture);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return null;
}
