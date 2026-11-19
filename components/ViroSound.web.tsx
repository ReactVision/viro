/**
 * Web implementation of ViroSound — non-spatial audio through Web Audio (see
 * viroAudioBuffer). Scene-level (renders no node). Playback the browser holds
 * back until a user gesture starts at that gesture (see viroMedia).
 */
import { useEffect, useImperativeHandle, useRef } from "react";
import { resolveImageSource } from "./Web/viroImageLoader";
import { getAudioContext } from "./Web/viroAudio";
import { createBufferSound, preloadSound, unloadSound, type BufferSound } from "./Web/viroAudioBuffer";

export type ViroSoundProps = {
  source: unknown;
  paused?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  onFinish?: () => void;
  onError?: (error: unknown) => void;
  [key: string]: any;
};

export function ViroSound(props: ViroSoundProps): null {
  const url = resolveImageSource(props.source);
  const soundRef = useRef<BufferSound | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  useImperativeHandle(props.ref, () => ({ seekToTime: (seconds: number) => soundRef.current?.seek(seconds) }), []);

  useEffect(() => {
    if (!url) return;
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const sound = createBufferSound(
      url,
      gain,
      () => propsRef.current.onFinish?.(),
      (err) => propsRef.current.onError?.(err),
    );
    gainRef.current = gain;
    soundRef.current = sound;
    return () => {
      sound.dispose();
      gain.disconnect();
      gainRef.current = null;
      soundRef.current = null;
    };
  }, [url]);

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

/** Loads each sound under its key, so a `source` of that key plays it without fetching. */
ViroSound.preloadSounds = async (
  soundMap: Record<string, unknown>,
): Promise<Record<string, { result: boolean; msg?: string }>> => {
  const results: Record<string, { result: boolean; msg?: string }> = {};
  for (const [key, source] of Object.entries(soundMap)) {
    const url = resolveImageSource(source);
    results[key] = url ? await preloadSound(key, url) : { result: false, msg: "no source" };
  }
  return results;
};

ViroSound.unloadSounds = (soundKeys: string[]) => {
  for (const key of soundKeys) unloadSound(key);
};
