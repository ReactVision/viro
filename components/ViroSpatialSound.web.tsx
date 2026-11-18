/**
 * Web implementation of ViroSpatialSound — positional audio via the Web Audio
 * PannerNode. The sound sits at `position` (world space); distance attenuation
 * follows `rolloffModel`/`minDistance`/`maxDistance`. Scene-level (no node).
 *
 * The AudioListener follows the AR session's tracked camera, so panning is
 * relative to where the user actually is. Outside an AR session there is no pose
 * to follow and it stays at the origin. Played through Web Audio (see
 * viroAudioBuffer); playback the browser holds back until a user gesture starts
 * at that gesture (see viroMedia).
 */
import { useEffect, useRef } from "react";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getAudioContext, trackAudioListener } from "./Web/viroAudio";
import { createBufferSound, type BufferSound } from "./Web/viroAudioBuffer";
import { useViroAR } from "./Web/ViroWebContext";

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
  const { session } = useViroAR();

  // Move the listener with the camera while this sound exists. Ref-counted, so
  // several sounds share one loop and the last one to unmount stops it.
  useEffect(() => {
    if (!session) return;
    return trackAudioListener(session);
  }, [session]);

  const soundRef = useRef<BufferSound | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!url) return;
    const ctx = getAudioContext();
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = distanceModel(propsRef.current.rolloffModel);
    panner.refDistance = propsRef.current.minDistance ?? 1;
    panner.maxDistance = propsRef.current.maxDistance ?? 10000;
    if (propsRef.current.rolloffModel === "None") panner.rolloffFactor = 0;
    setPannerPosition(panner, px, py, pz);
    const gain = ctx.createGain();
    panner.connect(gain).connect(ctx.destination);
    const sound = createBufferSound(
      url,
      panner,
      () => propsRef.current.onFinish?.(),
      (err) => propsRef.current.onError?.(err),
    );
    soundRef.current = sound;
    pannerRef.current = panner;
    gainRef.current = gain;

    return () => {
      sound.dispose();
      panner.disconnect();
      gain.disconnect();
      soundRef.current = null;
      pannerRef.current = null;
      gainRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Position updates.
  useEffect(() => {
    if (pannerRef.current) setPannerPosition(pannerRef.current, px, py, pz);
  }, [px, py, pz]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = props.muted ? 0 : (props.volume ?? 1);
  }, [props.muted, props.volume, url]);

  useEffect(() => {
    soundRef.current?.setLoop(props.loop ?? false);
  }, [props.loop, url]);

  // Any prop change starts a finished sound again unless paused, as native does.
  useEffect(() => {
    if (props.paused) soundRef.current?.pause();
    else soundRef.current?.play();
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  return null;
}
