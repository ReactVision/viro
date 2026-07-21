/**
 * Web implementation of ViroVideo — a surface textured with a playing
 * `<video>`. Each decoded frame is drawn to a canvas, uploaded as a texture and
 * applied to the surface's material (unlit). Reuses the per-frame upload pattern
 * from the AR camera background.
 *
 * MVP scope: source, width/height, paused, loop, muted, volume, onFinish/onError.
 * `stereoMode`, `resizeMode`, `onUpdateTime`, buffering events are follow-ups.
 *
 * Perf note: this recreates a texture per frame (same tradeoff as the AR camera
 * feed). A `viroUpdateTexture` C API would let it reuse one GL texture.
 */
import { useEffect, useRef } from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";

type Props = ViroWebNodeProps & {
  source: unknown;
  width?: number;
  height?: number;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

// requestVideoFrameCallback isn't in every TS DOM lib; access it via a cast.
function requestVideoFrame(video: HTMLVideoElement, cb: () => void): number | null {
  const fn = (video as any).requestVideoFrameCallback;
  return typeof fn === "function" ? fn.call(video, cb) : null;
}
function cancelVideoFrame(video: HTMLVideoElement, id: number): void {
  const fn = (video as any).cancelVideoFrameCallback;
  if (typeof fn === "function") fn.call(video, id);
}

export function ViroVideo(props: Props): null {
  const scene = useViroScene();
  const width = props.width ?? 1;
  const height = props.height ?? 1;
  const url = resolveImageSource(props.source);

  const geometryRef = useRef<ViroHandle>(0);
  useViroNode(props, (s) => {
    const geo = s.createSurface(width, height);
    geometryRef.current = geo;
    return geo;
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Create the <video> + per-frame texture upload; torn down when the URL changes.
  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo || !url) return;

    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    videoRef.current = video;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const material = scene.createMaterial();
    scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
    let currentTex = 0;
    let rafId = 0;
    let vfcId = 0;
    let cancelled = false;

    const uploadFrame = () => {
      if (cancelled || !ctx) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.drawImage(video, 0, 0, w, h);
        const rgba = ctx.getImageData(0, 0, w, h).data;
        // Flip Y: getImageData is top-row-first, GL samples v=0 at the bottom.
        const flipped = new Uint8Array(w * h * 4);
        const rowBytes = w * 4;
        for (let y = 0; y < h; y++) {
          flipped.set(rgba.subarray(y * rowBytes, y * rowBytes + rowBytes), (h - 1 - y) * rowBytes);
        }
        const tex = scene.createTextureRGBA(flipped, w, h, true);
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, tex);
        scene.setGeometryMaterial(geo, material);
        if (currentTex) scene.destroyTexture(currentTex);
        currentTex = tex;
      }
      scheduleNext();
    };

    const scheduleNext = () => {
      if (cancelled) return;
      const id = requestVideoFrame(video, uploadFrame);
      if (id != null) vfcId = id;
      else rafId = requestAnimationFrame(uploadFrame);
    };

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);

    scheduleNext();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (vfcId) cancelVideoFrame(video, vfcId);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onErr);
      video.pause();
      video.src = "";
      videoRef.current = null;
      if (currentTex) scene.destroyTexture(currentTex);
      scene.destroyMaterial(material);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Live playback controls applied to the current <video>.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = props.loop ?? false;
    v.muted = props.muted ?? false;
    if (props.volume != null) v.volume = props.volume;
    if (props.paused ?? false) {
      v.pause();
    } else {
      v.play().catch((err) => propsRef.current.onError?.(err));
    }
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  return null;
}
