/**
 * Web implementation of Viro360Video — an equirectangular video played on the
 * scene background sphere, each decoded frame uploaded into the sphere's texture.
 * Scene-level (renders no node).
 *
 * MVP scope: source, paused, loop, muted, volume, rotation, onFinish/onError,
 * onBufferStart/End, onUpdateTime and the ref's seekToTime.
 */
import { useEffect, useImperativeHandle, useRef } from "react";
import { useViroParentNode, useViroScene } from "./Web/ViroWebContext";
import { setViroBackgroundRotation, setViroBackgroundSphere } from "./Web/viroBackground";
import { resolveImageSource } from "./Web/viroImageLoader";
import {
  applyStereoMode,
  forwardMediaEvents,
  playWhenAllowed,
  seekMedia,
  streamVideoTexture,
  type ViroMediaEventProps,
} from "./Web/viroMedia";

type Props = ViroMediaEventProps & {
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
  const parent = useViroParentNode();
  const url = resolveImageSource(props.source);
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  useImperativeHandle(props.ref, () => ({
    seekToTime: (seconds: number) => seekMedia(videoRef.current, seconds),
  }), []);

  useEffect(() => {
    if (!url) return;

    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    videoRef.current = video;
    const stopEvents = forwardMediaEvents(video, () => propsRef.current);

    const stopTexture = streamVideoTexture(scene, video, (texture, changed) => {
      if (changed) {
        applyStereoMode(scene, texture, propsRef.current.stereoMode);
        setViroBackgroundSphere(scene, parent, texture);
      }
    });

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`video failed: ${url}`));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onErr);

    setViroBackgroundRotation(scene, parent, [rx, ry, rz]);

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
  }, [url, props.stereoMode]);

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
  }, [props.paused, props.loop, props.muted, props.volume, url, props.stereoMode]);

  useEffect(() => {
    setViroBackgroundRotation(scene, parent, [rx, ry, rz]);
  }, [scene, parent, rx, ry, rz]);

  return null;
}
