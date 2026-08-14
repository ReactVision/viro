"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroCameraTexture = void 0;
/**
 * ViroCameraTexture.web.tsx
 *
 * Web implementation of ViroCameraTexture — binds a live device-camera feed to
 * a registered material's diffuse channel. Any geometry using that material
 * name (e.g. a ViroQuad with materials={["selfieMat"]}) then shows the camera.
 * This mirrors the native behaviour: the component owns the camera texture and
 * writes it onto a named material; the material only needs a lightingModel.
 *
 * Reuses the per-frame upload pattern from ViroMaterialVideo / the AR camera
 * background: getUserMedia → hidden <video> → canvas → createTextureRGBA →
 * setMaterialTexture(Diffuse). Front camera is mirrored, matching native.
 *
 * The imperative capture API (capturePhoto / startRecording / stopRecording) is
 * exposed via a ref, same call sites as native. On web there is no filesystem
 * path, so `url` is a data: URL (photo) or an object URL (recording, webm), and
 * `outputPath` is ignored.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
exports.ViroCameraTexture = React.forwardRef(function ViroCameraTexture(props, ref) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const materialName = props.material;
    const facingMode = (props.cameraPosition ?? "front") === "back" ? "environment" : "user";
    const mirror = facingMode === "user";
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    const pausedRef = (0, react_1.useRef)(props.paused ?? false);
    pausedRef.current = props.paused ?? false;
    // The canvas holding the most-recent frame, and the live stream — read by the
    // imperative capture API.
    const canvasRef = (0, react_1.useRef)(null);
    const streamRef = (0, react_1.useRef)(null);
    const recorderRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!materialName)
            return;
        const material = (0, viroMaterialRegistry_1.getSharedMaterialHandle)(scene, materialName);
        if (!material)
            return;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasRef.current = canvas;
        let video = null;
        let rafId = 0;
        let currentTex = 0;
        let firstFrame = true;
        let cancelled = false;
        const uploadFrame = () => {
            if (cancelled || !ctx || !video)
                return;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (!pausedRef.current && w > 0 && h > 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                if (mirror) {
                    ctx.save();
                    ctx.setTransform(-1, 0, 0, 1, w, 0);
                    ctx.drawImage(video, 0, 0, w, h);
                    ctx.restore();
                }
                else {
                    ctx.drawImage(video, 0, 0, w, h);
                }
                const rgba = ctx.getImageData(0, 0, w, h).data;
                const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
                scene.setMaterialTexture(material, viro_web_renderer_1.ViroTextureChannel.Diffuse, tex);
                if (currentTex)
                    scene.destroyTexture(currentTex);
                currentTex = tex;
                if (firstFrame) {
                    firstFrame = false;
                    propsRef.current.onCameraReady?.();
                }
            }
            rafId = requestAnimationFrame(uploadFrame);
        };
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode },
                    audio: false,
                });
                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                streamRef.current = stream;
                video = document.createElement("video");
                video.playsInline = true;
                video.muted = true;
                video.srcObject = stream;
                // Safari won't decode/paint a detached <video>, so drawImage() would
                // yield black frames — attach it hidden to the DOM (same as arSession).
                video.setAttribute("aria-hidden", "true");
                Object.assign(video.style, {
                    position: "fixed",
                    top: "0",
                    left: "0",
                    width: "1px",
                    height: "1px",
                    opacity: "0",
                    pointerEvents: "none",
                    zIndex: "-1",
                });
                document.body.appendChild(video);
                await video.play();
                rafId = requestAnimationFrame(uploadFrame);
            }
            catch (err) {
                if (!cancelled) {
                    propsRef.current.onError?.({
                        nativeEvent: { error: err instanceof Error ? err.message : String(err) },
                    });
                }
            }
        })();
        return () => {
            cancelled = true;
            if (rafId)
                cancelAnimationFrame(rafId);
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
                recorderRef.current.stop();
            }
            recorderRef.current = null;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            if (video) {
                video.pause();
                video.srcObject = null;
                video.remove();
            }
            canvasRef.current = null;
            if (currentTex)
                scene.destroyTexture(currentTex);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [materialName, facingMode]);
    (0, react_1.useImperativeHandle)(ref, () => ({
        async capturePhoto() {
            const canvas = canvasRef.current;
            if (!canvas || canvas.width === 0) {
                return { success: false, error: "camera texture is not ready" };
            }
            try {
                return { success: true, url: canvas.toDataURL("image/jpeg", 0.92) };
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        },
        async startRecording() {
            const stream = streamRef.current;
            if (!stream)
                return { success: false, error: "camera is not started" };
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
                return { success: false, error: "already recording" };
            }
            if (typeof MediaRecorder === "undefined") {
                return { success: false, error: "MediaRecorder is not supported in this browser" };
            }
            try {
                const chunks = [];
                const recorder = new MediaRecorder(stream);
                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0)
                        chunks.push(e.data);
                };
                recorder._chunks = chunks;
                recorder.start();
                recorderRef.current = recorder;
                return { success: true, url: "" };
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        },
        async stopRecording() {
            const recorder = recorderRef.current;
            if (!recorder || recorder.state === "inactive") {
                return { success: false, error: "not recording" };
            }
            return new Promise((resolve) => {
                recorder.onstop = () => {
                    const chunks = recorder._chunks ?? [];
                    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
                    recorderRef.current = null;
                    resolve({ success: true, url: URL.createObjectURL(blob) });
                };
                recorder.stop();
            });
        },
    }), []);
    return null;
});
