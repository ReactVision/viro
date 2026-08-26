"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroImage = ViroImage;
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function ViroImage(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const width = props.width ?? props.style?.width ?? 1;
    const height = props.height ?? props.style?.height ?? 1;
    const geometryRef = (0, react_1.useRef)(0);
    const node = (0, useViroNode_1.useViroNode)(props, (s) => {
        const geo = s.createSurface(width, height);
        geometryRef.current = geo;
        return geo;
    });
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const materialRef = (0, react_1.useRef)(0);
    const textureRef = (0, react_1.useRef)(0);
    // Load the image and apply it as the surface's diffuse texture.
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useEffect)(() => {
        const geo = geometryRef.current;
        if (!geo || !url)
            return;
        let cancelled = false;
        propsRef.current.onLoadStart?.();
        (0, viroImageLoader_1.loadImageRGBA)(url)
            .then((img) => {
            if (cancelled)
                return;
            const texture = scene.createTextureRGBA(img.pixels, img.width, img.height, true);
            const material = scene.createMaterial();
            scene.setMaterialLightingModel(material, viro_web_renderer_1.ViroLightingModel.Constant);
            scene.setMaterialBlendMode(material, viro_web_renderer_1.ViroBlendMode.Alpha);
            scene.setMaterialTexture(material, viro_web_renderer_1.ViroTextureChannel.Diffuse, texture);
            scene.setGeometryMaterial(geo, material);
            textureRef.current = texture;
            materialRef.current = material;
            propsRef.current.onLoadEnd?.();
        })
            .catch((err) => {
            if (!cancelled)
                propsRef.current.onError?.(err);
        });
        return () => {
            cancelled = true;
            if (materialRef.current) {
                scene.destroyMaterial(materialRef.current);
                materialRef.current = 0;
            }
            if (textureRef.current) {
                scene.destroyTexture(textureRef.current);
                textureRef.current = 0;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
    return null;
}
