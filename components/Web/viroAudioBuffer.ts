/**
 * A sound decoded into memory and played through the shared AudioContext.
 *
 * iOS WebKit lets one media element play sound at a time and aborts the play()
 * of another, so a sound beside a video with sound went quiet. Web Audio mixes
 * any number of sounds beside a playing media element, as native does.
 */
import { getAudioContext } from "./viroAudio";
import { resumeAudioWhenAllowed } from "./viroMedia";

export type BufferSound = {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setLoop(loop: boolean): void;
  dispose(): void;
};

function loadBuffer(url: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    // The callback form, since older Safari's decodeAudioData returns no promise.
    .then(
      (data) =>
        new Promise<AudioBuffer>((resolve, reject) => {
          // Newer browsers also return a promise, which rejects beside the callback.
          ctx.decodeAudioData(data, resolve, reject)?.catch(() => {});
        })
    );
}

// ViroSound.preloadSounds: a string source names one of these, as on native.
const preloaded = new Map<string, Promise<AudioBuffer>>();

export async function preloadSound(name: string, url: string): Promise<{ result: boolean; msg?: string }> {
  const pending = loadBuffer(url);
  preloaded.set(name, pending);
  try {
    await pending;
    return { result: true };
  } catch (err) {
    if (preloaded.get(name) === pending) preloaded.delete(name);
    return { result: false, msg: String(err) };
  }
}

export function unloadSound(name: string): void {
  preloaded.delete(name);
}

/** `url` may also be the name a sound was preloaded under. */
export function createBufferSound(
  url: string,
  output: AudioNode,
  onFinish: () => void,
  onError: (error: unknown) => void
): BufferSound {
  const ctx = getAudioContext();
  let buffer: AudioBuffer | null = null;
  let source: AudioBufferSourceNode | null = null;
  let wanted = false;
  let loop = false;
  let offset = 0;
  let startedAt = 0;
  let disposed = false;

  const position = () => {
    if (!buffer || !source) return offset;
    const at = offset + ctx.currentTime - startedAt;
    return loop ? at % buffer.duration : Math.min(at, buffer.duration);
  };

  const start = () => {
    if (!buffer || source || disposed) return;
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    s.connect(output);
    // Also fires on stop(); pause() clears `source` first, so only a natural end gets here.
    s.onended = () => {
      if (source !== s) return;
      source = null;
      wanted = false;
      offset = 0;
      s.disconnect();
      onFinish();
    };
    source = s;
    startedAt = ctx.currentTime;
    s.start(0, offset);
  };

  const stop = () => {
    const s = source;
    if (!s) return;
    // A suspended context's clock stands still, so a sound paused before it ran keeps its place.
    offset = position();
    source = null;
    s.stop();
    s.disconnect();
  };

  (preloaded.get(url) ?? loadBuffer(url)).then(
    (decoded) => {
      buffer = decoded;
      if (wanted) start();
    },
    (err) => {
      if (!disposed) onError(new Error(`audio failed: ${url} (${err})`));
    }
  );

  return {
    play() {
      wanted = true;
      // iOS mutes Web Audio with the ring/silent switch unless the page asks for
      // playback; native's PlayAndRecord session plays through it.
      const session = (
        globalThis.navigator as { audioSession?: { type: string } } | undefined
      )?.audioSession;
      if (session?.type === "auto") session.type = "playback";
      // Now, so a tap while the file still loads unlocks the context.
      resumeAudioWhenAllowed(ctx);
      start();
    },
    pause() {
      wanted = false;
      stop();
    },
    seek(seconds) {
      const playing = source !== null;
      stop();
      const t = Math.max(0, seconds);
      offset = buffer ? (loop ? t % buffer.duration : Math.min(t, buffer.duration)) : t;
      if (playing) start();
    },
    setLoop(next) {
      if (source) {
        offset = position();
        startedAt = ctx.currentTime;
        source.loop = next;
      }
      loop = next;
    },
    dispose() {
      disposed = true;
      wanted = false;
      stop();
    },
  };
}
