import { NativeModules } from "react-native";

interface StreamingAudioNative {
  create(playerId: string): void;
  beginStreaming(playerId: string, sampleRate: number, channels: number): void;
  play(playerId: string): void;
  pause(playerId: string): void;
  setVolume(playerId: string, volume: number): void;
  setMuted(playerId: string, muted: boolean): void;
  /**
   * Push interleaved float32 PCM samples encoded as base64 (little-endian IEEE 754).
   *
   * JS encoding:
   *   const bytes = new Uint8Array(float32Array.buffer);
   *   const b64   = btoa(String.fromCharCode(...bytes));
   */
  pushSamples(playerId: string, base64Samples: string): void;
  destroy(playerId: string): void;
}

// RCT_EXPORT_MODULE() in newer RN (0.76+) keeps the "Module" suffix in NativeModules.
const native = (NativeModules.VRTStreamingAudioModule ?? NativeModules.VRTStreamingAudio) as
  | StreamingAudioNative
  | undefined;

function noop(..._args: unknown[]): void {}

/**
 * StreamingAudioManager — imperative API for streaming PCM audio.
 *
 * Typical TTS flow:
 *   StreamingAudioManager.create('tts');
 *   StreamingAudioManager.beginStreaming('tts', 24000, 1);
 *   StreamingAudioManager.play('tts');
 *   // on each TTS audio chunk:
 *   StreamingAudioManager.pushSamples('tts', base64FloatPCM);
 *   // when done:
 *   StreamingAudioManager.destroy('tts');
 */
export const StreamingAudioManager = {
  create: native
    ? (id: string) => native.create(id)
    : (noop as (id: string) => void),

  beginStreaming: native
    ? (id: string, sampleRate: number, channels: number) =>
        native.beginStreaming(id, sampleRate, channels)
    : (noop as (id: string, sr: number, ch: number) => void),

  play: native
    ? (id: string) => native.play(id)
    : (noop as (id: string) => void),

  pause: native
    ? (id: string) => native.pause(id)
    : (noop as (id: string) => void),

  setVolume: native
    ? (id: string, volume: number) => native.setVolume(id, volume)
    : (noop as (id: string, v: number) => void),

  setMuted: native
    ? (id: string, muted: boolean) => native.setMuted(id, muted)
    : (noop as (id: string, m: boolean) => void),

  pushSamples: native
    ? (id: string, base64: string) => native.pushSamples(id, base64)
    : (noop as (id: string, b64: string) => void),

  destroy: native
    ? (id: string) => native.destroy(id)
    : (noop as (id: string) => void),
};
