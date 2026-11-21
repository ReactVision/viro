/**
 * Web implementation of ViroMaterialVideo — plays a video onto a registered
 * material's diffuse channel. Any geometry using that material name shows the
 * video (named materials are shared via the registry). Scene-level (no node).
 *
 * MVP scope: material, source, paused, loop, muted, volume, onFinish/onError,
 * onBufferStart/End and onUpdateTime.
 */
import { useEffect, useRef } from "react";
import { ViroTextureChannel, type ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getSharedMaterialHandle } from "./Web/viroMaterialRegistry";
import {
  forwardMediaEvents,
  playWhenAllowed,
  streamVideoTexture,
  type ViroMediaEventProps,
} from "./Web/viroMedia";

type Props = ViroMediaEventProps & {
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
    const stopEvents = forwardMediaEvents(video, () => propsRef.current);

    const stopTexture = streamVideoTexture(scene, video, (texture, changed) => {
      if (changed) scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
    });

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);

    return () => {
      stopTexture();
      stopEvents();
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onErr);
      video.pause();
      video.src = "";
      videoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, materialName]);

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

  return null;
}
