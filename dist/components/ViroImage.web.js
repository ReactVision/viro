"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSurface = resolveSurface;
exports.ViroImage = ViroImage;
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
/** VRTImage.mm's kDefaultWidth / kDefaultHeight. */
const DEFAULT_SIZE = 1;
const WHOLE_PICTURE = [0, 0, 1, 1];
/**
 * The quad's dimensions and UVs, following VRTImage's rules.
 *
 * `aspect` is null until the picture has been decoded, because every branch but
 * the first needs to know its shape.
 */
function resolveSurface(width, height, sizeAuthored, resizeMode, resizeModeAuthored, aspect, clipMode = "ClipToBounds") {
    const whole = (w, h) => ({
        width: w,
        height: h,
        uv: WHOLE_PICTURE,
    });
    // Nothing to measure against yet, so the quad is the authored box — the same
    // 1x1 default a device starts with before its own download finishes.
    if (aspect === null)
        return whole(width, height);
    // No authored size: the picture sets the height and the width stays 1. This is
    // the case every Studio placement takes, since the node factory sends the
    // source and a resize mode but never a size.
    if (!sizeAuthored)
        return whole(width, width / aspect);
    // A size but no resize mode. Native leaves its _scaledWidth/_scaledHeight at
    // the 1x1 default here and draws a unit quad, ignoring the size that was
    // authored; that is its uninitialised state showing through rather than a
    // decision, so this honours the box instead, which is what its own default
    // resize mode (StretchToFill) says should happen.
    if (!resizeModeAuthored)
        return whole(width, height);
    const target = width / height;
    switch (resizeMode) {
        // Fit inside the box: the whole picture shows and the quad shrinks on the
        // axis with room to spare.
        case "ScaleToFit":
            return target <= aspect
                ? whole(width, width / aspect)
                : whole(height * aspect, height);
        case "ScaleToFill": {
            // Cover the box, keeping the picture's shape.
            const cover = target <= aspect
                ? { width: height * aspect, height }
                : { width, height: width / aspect };
            // None lets it overflow. ClipToBounds, native's default, keeps the
            // authored box and crops the overflow away through the UVs, centred — so
            // the middle of the picture survives rather than a corner.
            if (clipMode !== "ClipToBounds")
                return whole(cover.width, cover.height);
            const clipU = Math.abs(cover.width - width) / cover.width;
            const clipV = Math.abs(cover.height - height) / cover.height;
            return {
                width,
                height,
                uv: [clipU / 2, clipV / 2, 1 - clipU / 2, 1 - clipV / 2],
            };
        }
        default:
            return whole(width, height);
    }
}
function ViroImage(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const widthProp = props.width ?? props.style?.width;
    const heightProp = props.height ?? props.style?.height;
    const sizeAuthored = widthProp !== undefined || heightProp !== undefined;
    const width = widthProp ?? DEFAULT_SIZE;
    const height = heightProp ?? DEFAULT_SIZE;
    const resizeModeAuthored = props.resizeMode !== undefined;
    const resizeMode = props.resizeMode ?? "StretchToFill";
    // The decoded picture's aspect, which only the load can supply.
    const [aspect, setAspect] = (0, react_1.useState)(null);
    const surface = resolveSurface(width, height, sizeAuthored, resizeMode, resizeModeAuthored, aspect, props.imageClipMode ?? "ClipToBounds");
    const { width: surfaceWidth, height: surfaceHeight, uv } = surface;
    const uvKey = uv.join(",");
    const geometryRef = (0, react_1.useRef)(0);
    // Keyed on the resolved size so the surface is rebuilt once the picture lands
    // and the height stops being a guess.
    (0, useViroNode_1.useViroNode)(props, (s) => {
        const geo = s.createSurfaceUV(surfaceWidth, surfaceHeight, uv[0], uv[1], uv[2], uv[3]);
        geometryRef.current = geo;
        return geo;
    }, true, `${surfaceWidth}x${surfaceHeight}|${uvKey}`);
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const materialRef = (0, react_1.useRef)(0);
    const textureRef = (0, react_1.useRef)(0);
    // Load the image and apply it as the surface's diffuse texture. Re-runs when
    // the surface is rebuilt, since the material belongs to the geometry that was
    // just replaced. loadImageRGBA caches by URL, so the second pass costs a
    // texture upload rather than a download.
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
            // Rebuilds the surface on the first pass, and is a no-op on the second.
            if (img.height > 0)
                setAspect(img.width / img.height);
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
    }, [url, surfaceWidth, surfaceHeight, uvKey]);
    return null;
}
