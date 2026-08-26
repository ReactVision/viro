/**
 * Web implementation of Viro360Video — an equirectangular video played on the
 * scene background sphere. Each decoded frame is uploaded as a texture and set
 * via setBackgroundSphere. Scene-level (renders no node).
 *
 * MVP scope: source, paused, loop, muted, volume, rotation, onFinish/onError.
 * Perf: recreates a texture per frame (same tradeoff as ViroVideo).
 */
import { useEffect, useRef } from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";

type Props = {
  source: unknown;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  rotation?: [number, number, number];
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

export function Viro360Video(props: Props): null {
  const scene = useViroScene();
  const url = resolveImageSource(props.source);
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!url) return;

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
        const tex = scene.createTextureRGBA(new Uint8Array(rgba.buffer.slice(0)), w, h, true);
        scene.setBackgroundSphere(tex);
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

    scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Live playback controls + rotation.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = props.loop ?? false;
    v.muted = props.muted ?? false;
    if (props.volume != null) v.volume = props.volume;
    if (props.paused ?? false) v.pause();
    else v.play().catch((err) => propsRef.current.onError?.(err));
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  useEffect(() => {
    scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
  }, [scene, rx, ry, rz]);

  return null;
}
