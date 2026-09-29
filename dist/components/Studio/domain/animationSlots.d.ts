import type { StudioAnimation } from "../types";
import type { StudioEffectOrigin } from "./utils";
/** What a trigger does to its asset's slot. */
export type StudioAnimationRequest = "start" | "interrupt" | "queued";
type QueuedAnimation = {
    key: string;
    origin: StudioEffectOrigin;
};
/**
 * A node has one animation slot, so two animations on one asset cannot overlap
 * the way they do in the editor. This tracks what is playing on each asset,
 * what waits behind it, whether the play has run its on_start, and who started
 * it. A play another device started in a shared session runs neither on_start
 * nor on_finish here: that device ran them, and what they changed arrives as
 * shared state. A `device` play runs both, and what they play stays here too.
 */
export declare class StudioAnimationSlots {
    private live;
    private queued;
    private started;
    private origins;
    request(anim: StudioAnimation, loaded: boolean, origin: StudioEffectOrigin): StudioAnimationRequest;
    /** The runtime reported a start. True once per play, and only for one this device started. */
    runsOnStart(assetId: string): boolean;
    /** A non-looping play ended. True when this device started it and runs its on_finish. */
    finish(assetId: string): boolean;
    /** Who started the asset's latest play, which a finish does not clear. */
    origin(assetId: string): StudioEffectOrigin;
    /** The animation waiting behind the one that ended, if any. */
    next(assetId: string): QueuedAnimation | undefined;
    reset(): void;
    private markLive;
}
export {};
