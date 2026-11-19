/**
 * Playback and texture plumbing shared by the web video and sound components.
 *
 * Browsers refuse `play()` with sound (NotAllowedError) until the page has had a
 * tap, click or key press, where native starts at once. A refused element waits
 * for that gesture instead of failing; a video meanwhile plays muted, which every
 * browser allows, so its picture runs, and gets its sound on the gesture.
 */
import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";

type Wanted = { muted: boolean; onError?: (error: unknown) => void };

const wanted = new Map<HTMLMediaElement, Wanted>();
const blocked = new Set<HTMLMediaElement>();
const suspended = new Set<AudioContext>();
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
let listening = false;

function setListening(on: boolean): void {
  if (on === listening || typeof document === "undefined") return;
  listening = on;
  for (const type of GESTURES) {
    if (on) document.addEventListener(type, onGesture, true);
    else document.removeEventListener(type, onGesture, true);
  }
}

function stopIfIdle(): void {
  if (blocked.size === 0 && suspended.size === 0) setListening(false);
}

function watchResume(ctx: AudioContext): void {
  ctx.resume().then(
    () => {
      if (ctx.state !== "running") return;
      suspended.delete(ctx);
      stopIfIdle();
    },
    () => {},
  );
}

// Safari lets play() and resume() through only from inside the handler itself.
function onGesture(): void {
  // A touch's pointerdown grants no activation; its touchend does.
  const activation = (globalThis.navigator as { userActivation?: { isActive: boolean } } | undefined)
    ?.userActivation;
  if (activation && !activation.isActive) return;
  for (const ctx of suspended) watchResume(ctx);
  const retry = [...blocked];
  blocked.clear();
  for (const media of retry) {
    const w = wanted.get(media);
    if (w) start(media, w);
  }
  stopIfIdle();
}

function start(media: HTMLMediaElement, w: Wanted): void {
  media.muted = w.muted;
  media.play().catch((err: unknown) => {
    // Paused, unmounted or restarted since: an abort from that is not an error.
    if (wanted.get(media) !== w) return;
    if ((err as { name?: string } | null)?.name !== "NotAllowedError") {
      w.onError?.(err);
      return;
    }
    blocked.add(media);
    setListening(true);
    if (!w.muted && typeof HTMLVideoElement !== "undefined" && media instanceof HTMLVideoElement) {
      media.muted = true;
      media.play().catch(() => {});
    }
  });
}

/** Plays `media`, or waits for the first user gesture when the browser refuses. Returns the cancel. */
export function playWhenAllowed(
  media: HTMLMediaElement,
  muted: boolean,
  onError?: (error: unknown) => void,
): () => void {
  const w: Wanted = { muted, onError };
  wanted.set(media, w);
  start(media, w);
  return () => {
    if (wanted.get(media) !== w) return;
    wanted.delete(media);
    blocked.delete(media);
    stopIfIdle();
  };
}

/** Resumes a suspended AudioContext now if the browser allows it, else at the first user gesture. */
export function resumeAudioWhenAllowed(ctx: AudioContext): void {
  if (ctx.state !== "suspended") return;
  suspended.add(ctx);
  setListening(true);
  watchResume(ctx);
}

export type ViroMediaEventProps = {
  onBufferStart?: (event: { nativeEvent: Record<string, never> }) => void;
  onBufferEnd?: (event: { nativeEvent: Record<string, never> }) => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
};

/**
 * Native's buffering and progress callbacks from a media element. `props` is
 * read on each event, so the caller passes a getter over its latest props.
 * Attach before the element's first task runs: native reports buffering from
 * the moment the video is created, which here is `loadstart`.
 */
export function forwardMediaEvents(media: HTMLMediaElement, props: () => ViroMediaEventProps): () => void {
  let buffering = false;
  const bufferStart = () => {
    if (buffering) return;
    buffering = true;
    props().onBufferStart?.({ nativeEvent: {} });
  };
  const bufferEnd = () => {
    if (!buffering) return;
    buffering = false;
    props().onBufferEnd?.({ nativeEvent: {} });
  };
  const time = () =>
    props().onUpdateTime?.(media.currentTime, Number.isFinite(media.duration) ? media.duration : 0);
  const listeners: [string, () => void][] = [
    ["loadstart", bufferStart],
    ["waiting", bufferStart],
    ["canplay", bufferEnd],
    ["playing", bufferEnd],
    ["timeupdate", time],
  ];
  for (const [type, fn] of listeners) media.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of listeners) media.removeEventListener(type, fn);
  };
}

/** The ref method the video components share. */
export function seekMedia(media: HTMLMediaElement | null, seconds: number): void {
  if (media && Number.isFinite(seconds)) media.currentTime = Math.max(0, seconds);
}

// requestVideoFrameCallback isn't in every TS DOM lib; access it via a cast.
function requestVideoFrame(video: HTMLVideoElement, cb: () => void): number | null {
  const fn = (video as any).requestVideoFrameCallback;
  return typeof fn === "function" ? fn.call(video, cb) : null;
}
function cancelVideoFrame(video: HTMLVideoElement, id: number): void {
  const fn = (video as any).cancelVideoFrameCallback;
  if (typeof fn === "function") fn.call(video, id);
}

/**
 * Fills a texture from `video` on each new frame and passes it to `onFrame`,
 * with `changed` true when it is not the texture the last call had. The GPU
 * copies the frame straight from the element where the renderer can; a renderer
 * build without that reads each frame back through a canvas into a new texture.
 * Returns the stop, which destroys the texture.
 */
export function streamVideoTexture(
  scene: ViroSceneApi,
  video: HTMLVideoElement,
  onFrame: (texture: ViroHandle, changed: boolean) => void,
): () => void {
  const source = scene.createSourceTexture(true);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let current: ViroHandle = 0;
  let rafId = 0;
  let vfcId = 0;
  let cancelled = false;

  const upload = (): ViroHandle => {
    if (source) return scene.updateTextureFromSource(source, video) ? source : 0;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return 0;
    canvas ??= document.createElement("canvas");
    ctx ??= canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.drawImage(video, 0, 0, w, h);
    // Top row first, matching ViroImage's orientation.
    return scene.createTextureRGBA(new Uint8Array(ctx.getImageData(0, 0, w, h).data), w, h, true);
  };

  const step = () => {
    if (cancelled) return;
    if (video.readyState >= video.HAVE_CURRENT_DATA) {
      const texture = upload();
      if (texture) {
        const changed = texture !== current;
        onFrame(texture, changed);
        if (changed && current) scene.destroyTexture(current);
        current = texture;
      }
    }
    schedule();
  };

  const schedule = () => {
    if (cancelled) return;
    const id = requestVideoFrame(video, step);
    if (id != null) vfcId = id;
    else rafId = requestAnimationFrame(step);
  };

  schedule();

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (vfcId) cancelVideoFrame(video, vfcId);
    if (current) scene.destroyTexture(current);
    if (source && source !== current) scene.destroyTexture(source);
  };
}
