/**
 * Web implementation of Viro360Video — an equirectangular video played on the
 * scene background sphere, each decoded frame uploaded into the sphere's texture.
 * Scene-level (renders no node).
 *
 * MVP scope: source, paused, loop, muted, volume, rotation, onFinish/onError.
 */
import { useEffect, useRef } from "react";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { playWhenAllowed, streamVideoTexture } from "./Web/viroMedia";

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

    const stopTexture = streamVideoTexture(scene, video, (texture, changed) => {
      if (changed) scene.setBackgroundSphere(texture);
    });

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);

    scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);

    return () => {
      stopTexture();
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onErr);
      video.pause();
      video.src = "";
      videoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Live playback controls + rotation.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.loop = props.loop ?? false;
    if (props.volume != null) v.volume = props.volume;
    if (props.paused ?? false) {
      v.muted = props.muted ?? false;
      v.pause();
      return;
    }
    return playWhenAllowed(v, props.muted ?? false, (err) => propsRef.current.onError?.(err));
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  useEffect(() => {
    scene.setBackgroundRotation((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
  }, [scene, rx, ry, rz]);

  return null;
}
