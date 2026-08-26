import { GlobalListeners, isDev } from "./utils";

/**
 * Last-resort cap on how long a step waits for a non-looping PLAY to finish. A
 * clip that fails to load fires onError (released at once); a clip whose native
 * finish/error event is dropped or never arrives would otherwise stall the walk
 * forever, so the manager force-releases the waiter after this many ms.
 * Generous on purpose: it must outlast any realistic single clip so it never
 * cuts one short, only catches a genuine stall.
 */
export const SOUND_WAIT_BACKSTOP_MS = 5 * 60 * 1000;

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
  private listeners = new GlobalListeners();
  private nextPlayId = 1;
  // Per-playId completion callback for a step waiting on a non-looping PLAY.
  // Fired on natural finish (via remove) AND when the sound is cut short by a
  // stop/stopOthers/reset, so a waited-on sound never stalls the walk.
  private finishCallbacks = new Map<number, () => void>();
  // Backstop timer per waited playId; cleared whenever its callback fires so a
  // sound whose native finish/error event never arrives can't stall the walk.
  private finishTimers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Subscribe to any add/remove; returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  getActive(): StudioSoundEntry[] {
    return [...this.sounds.values()];
  }

  /** Pull and invoke the stored completion callback (if any) for a playId. */
  private fire(playId: number): void {
    const timer = this.finishTimers.get(playId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.finishTimers.delete(playId);
    }
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
    if (onFinish) {
      this.finishCallbacks.set(playId, onFinish);
      // Non-looping waited sound: arm the stall backstop. A looping sound is
      // never awaited, so it gets no timer.
      if (!entry.loop) {
        this.finishTimers.set(
          playId,
          setTimeout(() => this.remove(playId), SOUND_WAIT_BACKSTOP_MS)
        );
      }
    }
    if (isDev()) {
      console.log(`[Studio] Sound play "${entry.audioAssetId}" (#${playId})`);
    }
    this.listeners.notify();
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
    this.listeners.notify();
    // Resolve any waiters cut short by the stop.
    for (const id of removed) this.fire(id);
  }

  /** Drop one entry; onFinish calls this for non-looping sounds. */
  remove(playId: number): void {
    if (this.sounds.delete(playId)) this.listeners.notify();
    // Fire the stored callback whether or not the entry was still present
    // (natural finish path: resolves the waiting step).
    this.fire(playId);
  }

  reset(): void {
    const pending = [...this.finishCallbacks.keys()];
    this.sounds.clear();
    this.listeners.notify();
    // Belt-and-suspenders: the runtime's generation guard no-ops these after a
    // scene-change cancelAll, but fire so nothing leaks on bare resets.
    for (const id of pending) this.fire(id);
  }
}
