"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioSoundManager = void 0;
const utils_1 = require("./utils");
/**
 * Per-scene sound store. PLAY adds an entry under a fresh playId; STOP removes
 * by audio asset id (null = all). The whole <StudioSounds> list re-renders on
 * any change, so subscribers are GLOBAL like StudioVariableStore (not per-key).
 */
class StudioSoundManager {
    sounds = new Map();
    listeners = new Set();
    nextPlayId = 1;
    /** Subscribe to any add/remove; returns an unsubscribe fn. */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify() {
        // Snapshot first: a listener may (un)subscribe during its own callback.
        [...this.listeners].forEach((fn) => fn());
    }
    getActive() {
        return [...this.sounds.values()];
    }
    play(entry) {
        if (entry.stopOthers)
            this.sounds.clear();
        const playId = this.nextPlayId++;
        this.sounds.set(playId, {
            playId,
            audioAssetId: entry.audioAssetId,
            url: entry.url,
            position: entry.position,
            volume: entry.volume,
            loop: entry.loop,
        });
        if ((0, utils_1.isDev)()) {
            console.log(`[Studio] Sound play "${entry.audioAssetId}" (#${playId})`);
        }
        this.notify();
    }
    /** null = stop all sounds; otherwise stop every entry for this audio asset. */
    stop(audioAssetId) {
        if (audioAssetId === null)
            this.sounds.clear();
        else
            for (const [id, e] of this.sounds)
                if (e.audioAssetId === audioAssetId)
                    this.sounds.delete(id);
        this.notify();
    }
    /** Drop one entry; onFinish calls this for non-looping sounds. */
    remove(playId) {
        if (this.sounds.delete(playId))
            this.notify();
    }
    reset() {
        this.sounds.clear();
        this.notify();
    }
}
exports.StudioSoundManager = StudioSoundManager;
