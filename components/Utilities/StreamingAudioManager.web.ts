/**
 * StreamingAudioManager on the web: streamed float32 PCM (such as TTS) played
 * through the shared AudioContext. Same calls as the native module; see
 * StreamingAudioManager.ts for the flow.
 *
 * Each pushed chunk becomes an AudioBuffer scheduled right after the previous
 * one. Pausing keeps what has not played yet, as native's player node does.
 */
import { getAudioContext } from "../Web/viroAudio";
import { resumeAudioWhenAllowed } from "../Web/viroMedia";

type Chunk = { buffer: AudioBuffer; offset: number; source?: AudioBufferSourceNode; startAt?: number };

type Player = {
  gain: GainNode;
  sampleRate: number;
  channels: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  chunks: Chunk[];
  // Context time the last scheduled chunk ends at.
  endsAt: number;
};

const players = new Map<string, Player>();

function schedule(player: Player, chunk: Chunk): void {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = chunk.buffer;
  source.connect(player.gain);
  const startAt = Math.max(player.endsAt, ctx.currentTime);
  source.onended = () => {
    if (chunk.source !== source) return;
    source.disconnect();
    const i = player.chunks.indexOf(chunk);
    if (i >= 0) player.chunks.splice(i, 1);
  };
  source.start(startAt, chunk.offset);
  chunk.source = source;
  chunk.startAt = startAt;
  player.endsAt = startAt + chunk.buffer.duration - chunk.offset;
}

function applyGain(player: Player): void {
  player.gain.gain.value = player.muted ? 0 : player.volume;
}

function decode(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length - (binary.length % 4));
  for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
  // Little-endian, as the native module reads it; every browser this runs on is little-endian.
  return new Float32Array(bytes.buffer);
}

export const StreamingAudioManager = {
  create(id: string): void {
    StreamingAudioManager.destroy(id);
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    players.set(id, {
      gain,
      sampleRate: ctx.sampleRate,
      channels: 1,
      playing: false,
      volume: 1,
      muted: false,
      chunks: [],
      endsAt: 0,
    });
  },

  beginStreaming(id: string, sampleRate: number, channels: number): void {
    const player = players.get(id);
    if (!player) return;
    player.sampleRate = sampleRate;
    player.channels = Math.max(1, Math.floor(channels));
  },

  play(id: string): void {
    const player = players.get(id);
    if (!player || player.playing) return;
    player.playing = true;
    resumeAudioWhenAllowed(getAudioContext());
    player.endsAt = 0;
    for (const chunk of player.chunks) schedule(player, chunk);
  },

  pause(id: string): void {
    const player = players.get(id);
    if (!player || !player.playing) return;
    player.playing = false;
    const now = getAudioContext().currentTime;
    for (const chunk of player.chunks) {
      const source = chunk.source;
      if (!source) continue;
      chunk.source = undefined;
      source.stop();
      source.disconnect();
      // A chunk already under way resumes where it stopped.
      if (chunk.startAt !== undefined && now > chunk.startAt) chunk.offset += now - chunk.startAt;
    }
    player.chunks = player.chunks.filter((c) => c.offset < c.buffer.duration);
  },

  setVolume(id: string, volume: number): void {
    const player = players.get(id);
    if (!player) return;
    player.volume = volume;
    applyGain(player);
  },

  setMuted(id: string, muted: boolean): void {
    const player = players.get(id);
    if (!player) return;
    player.muted = muted;
    applyGain(player);
  },

  /** Interleaved float32 samples, base64-encoded little-endian. */
  pushSamples(id: string, base64Samples: string): void {
    const player = players.get(id);
    if (!player) return;
    const samples = decode(base64Samples);
    const frames = Math.floor(samples.length / player.channels);
    if (frames === 0) return;
    const buffer = getAudioContext().createBuffer(player.channels, frames, player.sampleRate);
    for (let c = 0; c < player.channels; c++) {
      const out = buffer.getChannelData(c);
      for (let f = 0; f < frames; f++) out[f] = samples[f * player.channels + c];
    }
    const chunk: Chunk = { buffer, offset: 0 };
    player.chunks.push(chunk);
    if (player.playing) schedule(player, chunk);
  },

  destroy(id: string): void {
    const player = players.get(id);
    if (!player) return;
    players.delete(id);
    for (const chunk of player.chunks) {
      chunk.source?.stop();
      chunk.source?.disconnect();
      chunk.source = undefined;
    }
    player.gain.disconnect();
  },
};
