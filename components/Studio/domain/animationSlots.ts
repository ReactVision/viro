import type { StudioAnimation } from "../types";
import type { StudioEffectOrigin } from "./utils";

/** What a trigger does to its asset's slot. */
export type StudioAnimationRequest = "start" | "interrupt" | "queued";

type LiveAnimation = { key: string; loop: boolean; interruptible: boolean };
type QueuedAnimation = { key: string; origin: StudioEffectOrigin };

/**
 * A node has one animation slot, so two animations on one asset cannot overlap
 * the way they do in the editor. This tracks what is playing on each asset,
 * what waits behind it, whether the play has run its on_start, and who started
 * it. A play another device started in a shared session runs neither on_start
 * nor on_finish here: that device ran them, and what they changed arrives as
 * shared state. A `device` play runs both, and what they play stays here too.
 */
export class StudioAnimationSlots {
  private live = new Map<string, LiveAnimation>();
  private queued = new Map<string, QueuedAnimation[]>();
  private started = new Set<string>();
  private origins = new Map<string, StudioEffectOrigin>();

  request(
    anim: StudioAnimation,
    loaded: boolean,
    origin: StudioEffectOrigin
  ): StudioAnimationRequest {
    const assetId = anim.target_asset_id;
    // A play requested before the asset loaded is held back until it loads and
    // then runs, so it holds the slot from then on. Until then nothing runs and
    // a later request simply replaces it.
    const live = loaded ? this.live.get(assetId) : undefined;
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
      this.markLive(anim, origin);
      return "interrupt";
    }
    this.markLive(anim, origin);
    return "start";
  }

  /** The runtime reported a start. True once per play, and only for one this device started. */
  runsOnStart(assetId: string): boolean {
    if (this.started.has(assetId)) return false;
    this.started.add(assetId);
    return this.origin(assetId) !== "remote";
  }

  /** A non-looping play ended. True when this device started it and runs its on_finish. */
  finish(assetId: string): boolean {
    this.live.delete(assetId);
    this.started.delete(assetId);
    return this.origin(assetId) !== "remote";
  }

  /** Who started the asset's latest play, which a finish does not clear. */
  origin(assetId: string): StudioEffectOrigin {
    return this.origins.get(assetId) ?? "local";
  }

  /** The animation waiting behind the one that ended, if any. */
  next(assetId: string): QueuedAnimation | undefined {
    return this.queued.get(assetId)?.shift();
  }

  reset(): void {
    this.live.clear();
    this.queued.clear();
    this.started.clear();
    this.origins.clear();
  }

  private markLive(anim: StudioAnimation, origin: StudioEffectOrigin) {
    const assetId = anim.target_asset_id;
    this.started.delete(assetId);
    this.origins.set(assetId, origin);
    this.live.set(assetId, {
      key: anim.animation_key,
      loop: anim.loop,
      interruptible: anim.interruptible,
    });
  }
}
