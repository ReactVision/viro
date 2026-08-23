/**
 * Web implementation of ViroSound — non-spatial audio playback via an
 * `<audio>` element. Scene-level (renders no node).
 *
 * Browser autoplay policies may block playback until a user gesture; the play()
 * rejection is surfaced via onError.
 */
import { useEffect, useRef } from "react";
import { resolveImageSource } from "./Web/viroImageLoader";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onEnded = () => propsRef.current.onFinish?.();
    const onErr = () => propsRef.current.onError?.(new Error(`audio failed: ${url}`));
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onErr);

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onErr);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = props.loop ?? false;
    a.muted = props.muted ?? false;
    a.volume = props.volume ?? 1;
    if (props.paused ?? false) a.pause();
    else a.play().catch((err) => propsRef.current.onError?.(err));
  }, [props.paused, props.loop, props.muted, props.volume, url]);

  return null;
}
