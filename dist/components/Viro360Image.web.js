"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro360Image = Viro360Image;
/**
 * Web implementation of Viro360Image — sets the scene background to a textured
 * sphere from an equirectangular image. Scene-level (renders no node).
 */
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function Viro360Image(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    (0, react_1.useEffect)(() => {
        if (!url)
            return;
        let cancelled = false;
        let texture = 0;
        props.onLoadStart?.();
        (0, viroImageLoader_1.loadImageRGBA)(url)
            .then((img) => {
            if (cancelled)
                return;
            texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
            scene.setBackgroundSphere(texture);
            scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
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
    }, [url, rx, ry, rz]);
    return null;
}
