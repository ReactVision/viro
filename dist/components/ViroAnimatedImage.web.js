"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroAnimatedImage = ViroAnimatedImage;
/**
 * ViroAnimatedImage.web.tsx
 *
 * Web implementation of ViroAnimatedImage — an animated image (GIF/APNG) on a
 * flat surface. The browser decodes and advances the animation inside an
 * <img> element on its own timeline; a per-frame draw of that <img> to a canvas
 * samples whatever frame is currently displayed and uploads it as the surface's
 * diffuse texture. This reuses the surface + per-frame-texture pattern from
 * ViroImage / ViroVideo, so the animation plays without any native decoder.
 *
 * MVP scope: source, width/height, transform props, paused, onLoadStart/
 * onLoadEnd/onError. `loop` follows the file's own loop count (a GIF encodes
 * its own looping — JS can't override it here). `placeholderSource`,
 * `resizeMode`, `stereoMode` are follow-ups, matching ViroImage.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
function ViroAnimatedImage(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const width = props.width ?? 1;
    const height = props.height ?? 1;
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const geometryRef = (0, react_1.useRef)(0);
    (0, useViroNode_1.useViroNode)(props, (s) => {
        const geo = s.createSurface(width, height);
        geometryRef.current = geo;
        return geo;
    });
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    const pausedRef = (0, react_1.useRef)(props.paused ?? false);
    pausedRef.current = props.paused ?? false;
    (0, react_1.useEffect)(() => {
        const geo = geometryRef.current;
        if (!geo || !url)
            return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const material = scene.createMaterial();
        scene.setMaterialLightingModel(material, viro_web_renderer_1.ViroLightingModel.Constant);
        scene.setMaterialBlendMode(material, viro_web_renderer_1.ViroBlendMode.Alpha);
        let currentTex = 0;
        let rafId = 0;
        let cancelled = false;
        const uploadFrame = () => {
            if (cancelled || !ctx)
                return;
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!pausedRef.current && w > 0 && h > 0) {
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                // Sampling the <img> each frame captures the GIF/APNG's current frame,
                // which the browser advances on its own animation clock.
                ctx.drawImage(img, 0, 0, w, h);
                const rgba = ctx.getImageData(0, 0, w, h).data;
                const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
                scene.setMaterialTexture(material, viro_web_renderer_1.ViroTextureChannel.Diffuse, tex);
                scene.setGeometryMaterial(geo, material);
                if (currentTex)
                    scene.destroyTexture(currentTex);
                currentTex = tex;
            }
            rafId = requestAnimationFrame(uploadFrame);
        };
        propsRef.current.onLoadStart?.();
        img.onload = () => {
            if (cancelled)
                return;
            propsRef.current.onLoadEnd?.();
            rafId = requestAnimationFrame(uploadFrame);
        };
        img.onerror = () => {
            if (!cancelled)
                propsRef.current.onError?.(new Error(`image failed: ${url}`));
        };
        img.src = url;
        return () => {
            cancelled = true;
            if (rafId)
                cancelAnimationFrame(rafId);
            img.onload = null;
            img.onerror = null;
            img.src = "";
            if (currentTex)
                scene.destroyTexture(currentTex);
            scene.destroyMaterial(material);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);
    return null;
}
