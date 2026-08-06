"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroMaterialVideo = ViroMaterialVideo;
/**
 * Web implementation of ViroMaterialVideo — plays a video onto a registered
 * material's diffuse channel. Any geometry using that material name shows the
 * video (named materials are shared via the registry). Scene-level (no node).
 *
 * MVP scope: material, source, paused, loop, muted, volume, onFinish/onError.
 * Perf: recreates a texture per frame (same tradeoff as ViroVideo).
 */
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroImageLoader_1 = require("./Web/viroImageLoader");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
function requestVideoFrame(video, cb) {
    const fn = video.requestVideoFrameCallback;
    return typeof fn === "function" ? fn.call(video, cb) : null;
}
function cancelVideoFrame(video, id) {
    const fn = video.cancelVideoFrameCallback;
    if (typeof fn === "function")
        fn.call(video, id);
}
function ViroMaterialVideo(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const url = (0, viroImageLoader_1.resolveImageSource)(props.source);
    const materialName = props.material;
    const videoRef = (0, react_1.useRef)(null);
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useEffect)(() => {
        if (!url || !materialName)
            return;
        const material = (0, viroMaterialRegistry_1.getSharedMaterialHandle)(scene, materialName);
        if (!material)
            return;
        const video = document.createElement("video");
        video.src = url;
        video.crossOrigin = "anonymous";
        video.playsInline = true;
        videoRef.current = video;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let currentTex = 0;
        let rafId = 0;
        let vfcId = 0;
        let cancelled = false;
        const uploadFrame = () => {
            if (cancelled || !ctx)
                return;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                ctx.drawImage(video, 0, 0, w, h);
                const rgba = ctx.getImageData(0, 0, w, h).data;
                // Upload as-is (top-first), matching ViroImage's orientation.
                const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
                scene.setMaterialTexture(material, viro_web_renderer_1.ViroTextureChannel.Diffuse, tex);
                if (currentTex)
                    scene.destroyTexture(currentTex);
                currentTex = tex;
            }
            const id = requestVideoFrame(video, uploadFrame);
            if (id != null)
                vfcId = id;
            else
                rafId = requestAnimationFrame(uploadFrame);
        };
        const onEnded = () => propsRef.current.onFinish?.();
        const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
        video.addEventListener("ended", onEnded);
        video.addEventListener("error", onErr);
        const id = requestVideoFrame(video, uploadFrame);
        if (id != null)
            vfcId = id;
        else
            rafId = requestAnimationFrame(uploadFrame);
        return () => {
            cancelled = true;
            if (rafId)
                cancelAnimationFrame(rafId);
            if (vfcId)
                cancelVideoFrame(video, vfcId);
            video.removeEventListener("ended", onEnded);
            video.removeEventListener("error", onErr);
            video.pause();
            video.src = "";
            videoRef.current = null;
            if (currentTex)
                scene.destroyTexture(currentTex);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, materialName]);
    (0, react_1.useEffect)(() => {
        const v = videoRef.current;
        if (!v)
            return;
        v.loop = props.loop ?? false;
        v.muted = props.muted ?? false;
        if (props.volume != null)
            v.volume = props.volume;
        if (props.paused ?? false)
            v.pause();
        else
            v.play().catch((err) => propsRef.current.onError?.(err));
    }, [props.paused, props.loop, props.muted, props.volume, url]);
    return null;
}
