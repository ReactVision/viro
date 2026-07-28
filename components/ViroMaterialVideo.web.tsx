/**
 * Web implementation of ViroMaterialVideo — plays a video onto a registered
 * material's diffuse channel. Any geometry using that material name shows the
 * video (named materials are shared via the registry). Scene-level (no node).
 *
 * MVP scope: material, source, paused, loop, muted, volume, onFinish/onError.
 * Perf: recreates a texture per frame (same tradeoff as ViroVideo).
 */
import { useEffect, useRef } from "react";
import { ViroTextureChannel, type ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getSharedMaterialHandle } from "./Web/viroMaterialRegistry";

type Props = {
  material?: string;
  source: unknown;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

function requestVideoFrame(video: HTMLVideoElement, cb: () => void): number | null {
  const fn = (video as any).requestVideoFrameCallback;
  return typeof fn === "function" ? fn.call(video, cb) : null;
}
function cancelVideoFrame(video: HTMLVideoElement, id: number): void {
  const fn = (video as any).cancelVideoFrameCallback;
  if (typeof fn === "function") fn.call(video, id);
}

export function ViroMaterialVideo(props: Props): null {
  const scene = useViroScene();
  const url = resolveImageSource(props.source);
  const materialName = props.material;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!url || !materialName) return;
    const material: ViroHandle = getSharedMaterialHandle(scene, materialName);
    if (!material) return;

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
        // Upload as-is (top-first), matching ViroImage's orientation.
        const tex = scene.createTextureRGBA(new Uint8Array(rgba), w, h, true);
        scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, tex);
        if (currentTex) scene.destroyTexture(currentTex);
        currentTex = tex;
      }
      const id = requestVideoFrame(video, uploadFrame);
      if (id != null) vfcId = id;
      else rafId = requestAnimationFrame(uploadFrame);
    };

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);

    const id = requestVideoFrame(video, uploadFrame);
    if (id != null) vfcId = id;
    else rafId = requestAnimationFrame(uploadFrame);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, materialName]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = props.loop ?? false;
    v.muted = props.muted ?? false;
    if (props.volume != null) v.volume = props.volume;
    if (props.paused ?? false) v.pause();
    else v.play().catch((err) => propsRef.current.onError?.(err));
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  return null;
}
