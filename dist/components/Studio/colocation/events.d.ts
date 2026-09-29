import type { StudioSoundCommand, StudioSoundManager } from "../domain/soundManager";
import type { StudioSceneResponse } from "../types";
export declare const STUDIO_EVENT_PREFIX = "evt:";
export declare const STUDIO_EVENT_SLOTS = 16;
/** How long an event for a scene this device is still loading waits for it. */
export declare const STUDIO_EVENT_WAIT_MS = 10000;
/** An effect every device repeats; the function that caused it runs on one. */
export type StudioSharedEvent = {
    kind: "animation";
    sceneId: string;
    assetId: string;
    key: string;
} | ({
    kind: "sound";
    sceneId: string;
} & StudioSoundCommand);
export type StudioEventTarget = {
    sceneId: string;
    /** Plays without the animation's on_start or on_finish. */
    playAnimation?: (assetId: string, key: string) => void;
    sounds?: StudioSoundManager | null;
    /** The clips the scene's functions play. */
    audioUrls: ReadonlySet<string>;
};
export type StudioEventHost = {
    isSynced(): boolean;
    localPeerId(): string;
    write(id: string, fields: Record<string, unknown>): void;
    now(): number;
};
type Fields = Record<string, unknown>;
/** Every clip a scene's functions can play, however deeply nested. */
export declare function sceneAudioUrls(sceneData: StudioSceneResponse | null): Set<string>;
/**
 * `evt:<slot>`: a ring of 16 rows holding the room's latest animation triggers
 * and sound commands. An event goes into slot `n % 16`, `n` one past the
 * newest this device has seen, and each accepted write to a slot fires once on
 * every other device. A welcome or snapshot only marks the slots seen, so a
 * device that joins or reconnects replays nothing and gets the resulting state
 * from the other rows.
 */
export declare class StudioEventRing {
    private host;
    private target;
    private unsubscribeSounds;
    private newest;
    /** Events for a scene this device is on its way to, until it attaches. */
    private waiting;
    constructor(host: StudioEventHost);
    bind(target: StudioEventTarget | null): void;
    emit(event: StudioSharedEvent): void;
    /** An accepted write to a slot, in the room's order. */
    receive(fields: Fields): void;
    /** A slot whose writes in between went unseen: counted, not fired. */
    seen(fields: Fields): void;
    dispose(): void;
    private fire;
}
export {};
