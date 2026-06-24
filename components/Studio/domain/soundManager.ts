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
  // Per-playId completion callback for a step waiting on a non-looping PLAY.
  // Fired on natural finish (via remove) AND when the sound is cut short by a
  // stop/stopOthers/reset, so a waited-on sound never stalls the walk.
  private finishCallbacks = new Map<number, () => void>();

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

  /** Pull and invoke the stored completion callback (if any) for a playId. */
  private fire(playId: number): void {
    const cb = this.finishCallbacks.get(playId);
    if (!cb) return;
    this.finishCallbacks.delete(playId);
    cb();
  }

  /**
   * Adds a sound and returns its playId. onFinish (when given) resolves a step
   * waiting on a non-looping PLAY; it fires on natural finish or early stop.
   */
  play(
    entry: {
      audioAssetId: string;
      url: string;
      position?: [number, number, number];
      volume: number;
      loop: boolean;
      stopOthers: boolean;
    },
    onFinish?: () => void
  ): number {
    // stopOthers clears the live list; fire any pending waiters for the cleared
    // entries so a displaced waited-on sound resolves instead of stalling.
    if (entry.stopOthers) {
      const cleared = [...this.sounds.keys()];
      this.sounds.clear();
      for (const id of cleared) this.fire(id);
    }
    const playId = this.nextPlayId++;
    this.sounds.set(playId, {
      playId,
      audioAssetId: entry.audioAssetId,
      url: entry.url,
      position: entry.position,
      volume: entry.volume,
      loop: entry.loop,
    });
    if (onFinish) this.finishCallbacks.set(playId, onFinish);
    if (isDev()) {
      console.log(`[Studio] Sound play "${entry.audioAssetId}" (#${playId})`);
    }
    this.notify();
    return playId;
  }

  /** null = stop all sounds; otherwise stop every entry for this audio asset. */
  stop(audioAssetId: string | null): void {
    const removed: number[] = [];
    for (const [id, e] of this.sounds) {
      if (audioAssetId === null || e.audioAssetId === audioAssetId) {
        this.sounds.delete(id);
        removed.push(id);
      }
    }
    this.notify();
    // Resolve any waiters cut short by the stop.
    for (const id of removed) this.fire(id);
  }

  /** Drop one entry; onFinish calls this for non-looping sounds. */
  remove(playId: number): void {
    if (this.sounds.delete(playId)) this.notify();
    // Fire the stored callback whether or not the entry was still present
    // (natural finish path: resolves the waiting step).
    this.fire(playId);
  }

  reset(): void {
    const pending = [...this.finishCallbacks.keys()];
    this.sounds.clear();
    this.notify();
    // Belt-and-suspenders: the runtime's generation guard no-ops these after a
    // scene-change cancelAll, but fire so nothing leaks on bare resets.
    for (const id of pending) this.fire(id);
  }
}
