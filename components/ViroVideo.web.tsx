/**
 * Web implementation of ViroVideo — a surface textured with a playing
 * `<video>`, each decoded frame uploaded into the surface's (unlit) material.
 *
 * MVP scope: source, width/height, paused, loop, muted, volume, onFinish/onError.
 * `stereoMode`, `resizeMode`, `onUpdateTime`, buffering events are follow-ups.
 */
import { useEffect, useRef, useState } from "react";
import {
  ViroLightingModel,
  ViroTextureChannel,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { useViroScene } from "./Web/ViroWebContext";
import { resolveImageSource } from "./Web/viroImageLoader";
import { playWhenAllowed, streamVideoTexture } from "./Web/viroMedia";

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

export function ViroVideo(props: Props): null {
  const scene = useViroScene();
  const url = resolveImageSource(props.source);

  // With neither size prop given the surface takes the source's aspect ratio at one
  // unit wide, the rule the phone bridges apply. 1 until the metadata loads.
  const [aspect, setAspect] = useState(1);
  // Inside a ViroFlexView the layout decides the size, as it does natively, and
  // that counts as the size being set: the slot does not grow to the video.
  const slot = useViroFlexSlot();
  const sizePropSet = slot != null || props.width != null || props.height != null;
  const width = slot?.width ?? props.width ?? 1;
  const height = slot?.height ?? props.height ?? (sizePropSet ? 1 : width / aspect);

  const geometryRef = useRef<ViroHandle>(0);
  useViroNode(
    props,
    (s) => {
      const geo = s.createSurface(width, height);
      geometryRef.current = geo;
      return geo;
    },
    true,
    sizePropSet ? undefined : aspect
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Create the <video> + per-frame texture upload; torn down when the URL changes.
  useEffect(() => {
    if (!url) return;

    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    videoRef.current = video;

    const material = scene.createMaterial();
    scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
    let appliedGeometry: ViroHandle = 0;
    const stopTexture = streamVideoTexture(scene, video, (texture, changed) => {
      if (changed) scene.setMaterialTexture(material, ViroTextureChannel.Diffuse, texture);
      // Read per frame rather than capturing: the surface is rebuilt when the
      // video's aspect ratio arrives, which replaces the handle.
      const geo = geometryRef.current;
      if (geo && geo !== appliedGeometry) {
        scene.setGeometryMaterial(geo, material);
        appliedGeometry = geo;
      }
    });

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    const onMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspect(video.videoWidth / video.videoHeight);
      }
    };
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);
    video.addEventListener("loadedmetadata", onMetadata);

    return () => {
      stopTexture();
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onErr);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.pause();
      video.src = "";
      videoRef.current = null;
      scene.destroyMaterial(material);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Live playback controls applied to the current <video>.
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
