"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioAnimationSlots = void 0;
/**
 * A node has one animation slot, so two animations on one asset cannot overlap
 * the way they do in the editor. This tracks what is playing on each asset,
 * what waits behind it, whether the play has run its on_start, and who started
 * it. A play another device started in a shared session runs neither on_start
 * nor on_finish here: that device ran them, and what they changed arrives as
 * shared state. A `device` play runs both, and what they play stays here too.
 */
class StudioAnimationSlots {
    live = new Map();
    queued = new Map();
    started = new Set();
    origins = new Map();
    request(anim, loaded, origin) {
        const assetId = anim.target_asset_id;
        const live = this.live.get(assetId);
        if (live && live.key !== anim.animation_key) {
            if (!live.loop && !live.interruptible) {
                // Let the running one finish and play this next. The editor runs both
                // at once and the runtime cannot, but in sequence the asset at least
                // ends up where running both would have left it, and nothing is lost.
                const queue = this.queued.get(assetId) ?? [];
                const last = queue[queue.length - 1];
                if (last?.key !== anim.animation_key || last.origin !== origin) {
                    queue.push({ key: anim.animation_key, origin });
                    this.queued.set(assetId, queue);
                }
                return "queued";
            }
            // A loop never finishes and an interruptible animation is one the author
            // said may be cut short, so this one takes the slot now.
            this.markLive(anim, loaded, origin);
            return "interrupt";
        }
        this.markLive(anim, loaded, origin);
        return "start";
    }
    /** The runtime reported a start. True once per play, and only for one this device started. */
    runsOnStart(assetId) {
        if (this.started.has(assetId))
            return false;
        this.started.add(assetId);
        return this.origin(assetId) !== "remote";
    }
    /** A non-looping play ended. True when this device started it and runs its on_finish. */
    finish(assetId) {
        this.live.delete(assetId);
        this.started.delete(assetId);
        return this.origin(assetId) !== "remote";
    }
    /** Who started the asset's latest play, which a finish does not clear. */
    origin(assetId) {
        return this.origins.get(assetId) ?? "local";
    }
    /** The animation waiting behind the one that ended, if any. */
    next(assetId) {
        return this.queued.get(assetId)?.shift();
    }
    reset() {
        this.live.clear();
        this.queued.clear();
        this.started.clear();
        this.origins.clear();
    }
    markLive(anim, loaded, origin) {
        const assetId = anim.target_asset_id;
        this.started.delete(assetId);
        this.origins.set(assetId, origin);
        // An asset that has not loaded yet never starts, so it never reports a
        // finish either. Leaving it out keeps a later trigger from waiting behind
        // an animation that is not going to run.
        if (!loaded) {
            this.live.delete(assetId);
            return;
        }
        this.live.set(assetId, {
            key: anim.animation_key,
            loop: anim.loop,
            interruptible: anim.interruptible,
        });
    }
}
exports.StudioAnimationSlots = StudioAnimationSlots;
