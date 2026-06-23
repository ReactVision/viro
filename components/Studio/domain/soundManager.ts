import { isDev } from "./utils";

/** One actively-playing sound, keyed in the manager by its monotonic playId. */
export type StudioSoundEntry = {
  playId: number;
  audioAssetId: string;
  url: string;
  position?: [number, number, number];
  volume: number;
  loop: boolean;
};

/**
 * Per-scene sound store. PLAY adds an entry under a fresh playId; STOP removes
 * by audio asset id (null = all). The whole <StudioSounds> list re-renders on
 * any change, so subscribers are GLOBAL like StudioVariableStore (not per-key).
 */
export class StudioSoundManager {
  private sounds = new Map<number, StudioSoundEntry>();
  private listeners = new Set<() => void>();
  private nextPlayId = 1;

  /** Subscribe to any add/remove; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    // Snapshot first: a listener may (un)subscribe during its own callback.
    [...this.listeners].forEach((fn) => fn());
  }

  getActive(): StudioSoundEntry[] {
    return [...this.sounds.values()];
  }

  play(entry: {
    audioAssetId: string;
    url: string;
    position?: [number, number, number];
    volume: number;
    loop: boolean;
    stopOthers: boolean;
  }): void {
    if (entry.stopOthers) this.sounds.clear();
    const playId = this.nextPlayId++;
    this.sounds.set(playId, {
      playId,
      audioAssetId: entry.audioAssetId,
      url: entry.url,
      position: entry.position,
      volume: entry.volume,
      loop: entry.loop,
    });
    if (isDev()) {
      console.log(`[Studio] Sound play "${entry.audioAssetId}" (#${playId})`);
    }
    this.notify();
  }

  /** null = stop all sounds; otherwise stop every entry for this audio asset. */
  stop(audioAssetId: string | null): void {
    if (audioAssetId === null) this.sounds.clear();
    else
      for (const [id, e] of this.sounds)
        if (e.audioAssetId === audioAssetId) this.sounds.delete(id);
    this.notify();
  }

  /** Drop one entry; onFinish calls this for non-looping sounds. */
  remove(playId: number): void {
    if (this.sounds.delete(playId)) this.notify();
  }

  reset(): void {
    this.sounds.clear();
    this.notify();
  }
}
