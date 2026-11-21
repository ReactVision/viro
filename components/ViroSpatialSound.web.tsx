/**
 * Web implementation of ViroSpatialSound — positional audio via the Web Audio
 * PannerNode. The sound sits at `position` in its parent node's space, as on
 * native; distance attenuation follows `rolloffModel`/`minDistance`/`maxDistance`.
 * Renders no node of its own.
 *
 * The AudioListener follows the AR session's tracked camera, and without a
 * session the camera the navigator publishes (the desktop virtual camera, or the
 * 3D navigators' default). Played through Web Audio (see viroAudioBuffer);
 * playback the browser holds back until a user gesture starts at that gesture
 * (see viroMedia).
 */
import { useEffect, useImperativeHandle, useRef } from "react";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getAudioContext, trackAudioListener } from "./Web/viroAudio";
import { createBufferSound, type BufferSound } from "./Web/viroAudioBuffer";
import { useViroAR, useViroParentNode, useViroScene } from "./Web/ViroWebContext";
import { cameraView } from "./Web/viroDrag";
import { quatFromEulerDegrees, rotateByQuaternion, type Vec3 } from "./Web/viroMath";

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

// Native's defaults (VRTSound.mm): no rolloff, between 0 and 10 metres.
function applyRolloff(panner: PannerNode, props: Props): void {
  const max = props.maxDistance ?? 10;
  switch (props.rolloffModel) {
    case "Linear":
      panner.distanceModel = "linear";
      panner.rolloffFactor = 1;
      panner.refDistance = props.minDistance ?? 0;
      panner.maxDistance = max;
      break;
    case "Logarithmic":
      panner.distanceModel = "inverse";
      panner.rolloffFactor = 1;
      // The inverse model is silent at every distance with a reference of 0.
      panner.refDistance = props.minDistance || 1;
      panner.maxDistance = max;
      break;
    default:
      panner.rolloffFactor = 0;
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
  const scene = useViroScene();
  const parent = useViroParentNode();

  // Move the listener with the camera while this sound exists. Ref-counted, so
  // several sounds share one loop and the last one to unmount stops it.
  useEffect(() => {
    if (session) return trackAudioListener(session);
    return trackAudioListener({
      get cameraPose() {
        const view = cameraView(scene);
        return view ? { position: view.position, quaternion: view.orientation } : null;
      },
    });
  }, [session, scene]);

  const soundRef = useRef<BufferSound | null>(null);
  const pannerRef = useRef<PannerNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  useImperativeHandle(props.ref, () => ({ seekToTime: (seconds: number) => soundRef.current?.seek(seconds) }), []);

  useEffect(() => {
    if (!url) return;
    const ctx = getAudioContext();
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    applyRolloff(panner, propsRef.current);
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

  useEffect(() => {
    if (pannerRef.current) applyRolloff(pannerRef.current, propsRef.current);
  }, [props.rolloffModel, props.minDistance, props.maxDistance, url]);

  // Native moves the sound with its parent node every frame.
  useEffect(() => {
    let last = "";
    let raf = 0;
    const step = () => {
      const panner = pannerRef.current;
      if (panner) {
        const t = typeof scene.getNodeWorldTransform === "function" ? scene.getNodeWorldTransform(parent) : null;
        const local: Vec3 = t ? [px * t.scale[0], py * t.scale[1], pz * t.scale[2]] : [px, py, pz];
        const turned = t ? rotateByQuaternion(quatFromEulerDegrees(t.rotation), local) : local;
        const world = t ? turned.map((v, i) => v + t.position[i]) : turned;
        const key = world.join();
        if (key !== last) {
          last = key;
          setPannerPosition(panner, world[0], world[1], world[2]);
        }
      }
      raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [scene, parent, px, py, pz, url]);

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
