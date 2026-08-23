/**
 * Web implementation of ViroSpatialSound — positional audio via the Web Audio
 * PannerNode. The sound sits at `position` (world space); distance attenuation
 * follows `rolloffModel`/`minDistance`/`maxDistance`. Scene-level (no node).
 *
 * MVP note: the AudioListener stays at the world origin (not camera-tracked yet),
 * so panning is relative to origin. Autoplay may be blocked until a user gesture.
 */
import { useEffect, useRef } from "react";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getAudioContext } from "./Web/viroAudio";

type Props = {
  source: unknown;
  position: [number, number, number];
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  rolloffModel?: "None" | "Linear" | "Logarithmic" | string;
  minDistance?: number;
  maxDistance?: number;
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

function distanceModel(rolloff?: string): DistanceModelType {
  switch (rolloff) {
    case "Logarithmic":
      return "inverse";
    case "Linear":
      return "linear";
    default:
      return "inverse";
  }
}

function setPannerPosition(panner: PannerNode, x: number, y: number, z: number) {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    // Deprecated fallback for older Safari.
    (panner as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(x, y, z);
  }
}

export function ViroSpatialSound(props: Props): null {
  const url = resolveImageSource(props.source);
  const [px, py, pz] = props.position ?? [0, 0, 0];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!url) return;
    const ctx = getAudioContext();
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const src = ctx.createMediaElementSource(audio);
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = distanceModel(propsRef.current.rolloffModel);
    panner.refDistance = propsRef.current.minDistance ?? 1;
    panner.maxDistance = propsRef.current.maxDistance ?? 10000;
    if (propsRef.current.rolloffModel === "None") panner.rolloffFactor = 0;
    setPannerPosition(panner, px, py, pz);
    const gain = ctx.createGain();
    gain.gain.value = propsRef.current.volume ?? 1;
    src.connect(panner).connect(gain).connect(ctx.destination);
    pannerRef.current = panner;
    gainRef.current = gain;

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`audio failed: ${url}`));
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onErr);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onErr);
      audio.pause();
      audio.src = "";
      src.disconnect();
      panner.disconnect();
      gain.disconnect();
      audioRef.current = null;
      pannerRef.current = null;
      gainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Position updates.
  useEffect(() => {
    if (pannerRef.current) setPannerPosition(pannerRef.current, px, py, pz);
  }, [px, py, pz]);

  // Playback controls.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = props.loop ?? false;
    a.muted = props.muted ?? false;
    if (gainRef.current) gainRef.current.gain.value = props.volume ?? 1;
    if (props.paused ?? false) {
      a.pause();
    } else {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") void ctx.resume();
      a.play().catch((err) => propsRef.current.onError?.(err));
    }
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  return null;
}
