/**
 * Ambient light estimate for web AR, from the camera feed itself. tinyvio
 * reports none, and the browser gives no exposure metadata to correct by, so
 * this reads what the frame shows. A phone's auto exposure holds an ordinary
 * room near mid grey, which reads as the neutral 1000 ARKit and ARCore report
 * for a neutrally lit room; the reading drops once a room is too dark for the
 * exposure to make up, and climbs in a bright one.
 */
import { useEffect, useRef } from "react";
import type { ViroArSession } from "@reactvision/viro-web-renderer";

/** What both native runtimes report for a neutrally lit room. */
const NEUTRAL_INTENSITY = 1000;
/**
 * Mean frame luminance (sRGB, 0..1) a phone's auto exposure settles an
 * ordinary room at: middle grey, 18% reflectance, encodes to about 0.46.
 */
const NEUTRAL_LUMINANCE = 0.46;
const SAMPLE_WIDTH = 32;
const SAMPLE_HEIGHT = 24;
const SAMPLE_INTERVAL_MS = 250;
/** Weight of each new sample, so one dark frame (a hand over the lens) does not flash the scene. */
const SMOOTHING = 0.3;

export interface ViroWebAmbientLight {
  intensity: number;
  color: string;
}

/** Mean luminance and colour of RGBA pixels, as an estimate in native units. */
export function estimateAmbientLight(rgba: ArrayLike<number>): ViroWebAmbientLight | null {
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return null;
  for (let i = 0; i < pixels * 4; i += 4) {
    r += rgba[i]!;
    g += rgba[i + 1]!;
    b += rgba[i + 2]!;
  }
  r /= pixels * 255;
  g /= pixels * 255;
  b /= pixels * 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max = Math.max(r, g, b);
  const hex = (v: number) =>
    Math.round((max > 0 ? v / max : 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return {
    intensity: (luminance / NEUTRAL_LUMINANCE) * NEUTRAL_INTENSITY,
    color: `#${hex(r)}${hex(g)}${hex(b)}`,
  };
}

/**
 * The camera <video> the session draws the feed from. The session keeps it
 * private; when it is not there, nothing is estimated and the scene keeps its
 * authored lighting.
 */
function sessionVideo(session: ViroArSession): HTMLVideoElement | null {
  const video = (session as unknown as { video?: unknown }).video;
  return typeof HTMLVideoElement !== "undefined" && video instanceof HTMLVideoElement
    ? video
    : null;
}

/** Calls `onUpdate` a few times a second with a smoothed estimate while the session runs. */
export function useViroLightEstimate(
  session: ViroArSession | null,
  onUpdate: ((light: ViroWebAmbientLight) => void) | undefined,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const wanted = !!onUpdate;

  useEffect(() => {
    if (!session || !wanted || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let smoothed: number | null = null;
    const timer = setInterval(() => {
      const video = sessionVideo(session);
      if (!video || video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const sample = estimateAmbientLight(ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data);
      if (!sample) return;
      smoothed =
        smoothed === null ? sample.intensity : smoothed + (sample.intensity - smoothed) * SMOOTHING;
      onUpdateRef.current?.({ intensity: smoothed, color: sample.color });
    }, SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session, wanted]);
}
