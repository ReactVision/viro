/**
 * Shared Web Audio context for spatial sound, and the listener that follows the
 * camera.
 *
 * Lazily created (browsers require a user gesture to resume it; callers should
 * catch play() rejections).
 */

import { cameraBasis, type Quat, type Vec3 } from "./viroMath";

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

/** Anything that can say where the camera is. The AR session is the implementor. */
export interface ViroAudioListenerSource {
  readonly cameraPose: { position: Vec3; quaternion: Quat };
}

function setListenerPose(listener: AudioListener, position: Vec3, quaternion: Quat): void {
  // virocore's camera convention is the one Web Audio's forward/up vectors use,
  // so the basis carries over rotated with no axis swap.
  const { forward, up } = cameraBasis(quaternion);
  const [fx, fy, fz] = forward;
  const [ux, uy, uz] = up;
  const [px, py, pz] = position;

  if (listener.positionX) {
    listener.positionX.value = px;
    listener.positionY.value = py;
    listener.positionZ.value = pz;
    listener.forwardX.value = fx;
    listener.forwardY.value = fy;
    listener.forwardZ.value = fz;
    listener.upX.value = ux;
    listener.upY.value = uy;
    listener.upZ.value = uz;
    return;
  }
  // Deprecated fallback for older Safari, which has no AudioParam listener.
  const legacy = listener as unknown as {
    setPosition: (x: number, y: number, z: number) => void;
    setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void;
  };
  legacy.setPosition(px, py, pz);
  legacy.setOrientation(fx, fy, fz, ux, uy, uz);
}

/**
 * Keep the Web Audio listener on the camera for as long as at least one caller
 * wants it there.
 *
 * One loop no matter how many sounds are playing: the listener is a property of
 * the context, not of any sound, so a loop per sound would write the same values
 * several times a frame. Returns the release for this caller; the loop stops
 * when the last one releases.
 */
export function trackAudioListener(source: ViroAudioListenerSource): () => void {
  listenerSources.add(source);
  if (rafId === null) {
    const step = () => {
      const current = listenerSources.values().next().value;
      if (current) {
        const { position, quaternion } = current.cameraPose;
        setListenerPose(getAudioContext().listener, position, quaternion);
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    listenerSources.delete(source);
    if (listenerSources.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

const listenerSources = new Set<ViroAudioListenerSource>();
let rafId: number | null = null;
