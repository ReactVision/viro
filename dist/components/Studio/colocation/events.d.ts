import type { StudioSoundCommand, StudioSoundManager } from "../domain/soundManager";
import type { StudioSceneResponse } from "../types";
export declare const STUDIO_EVENT_PREFIX = "evt:";
/** Events each device's row keeps, so a batched or coalesced write loses none. */
export declare const STUDIO_EVENT_HISTORY = 8;
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
 * `evt:<peerId>` = `{ events }`: each device's own row, holding its latest
 * `STUDIO_EVENT_HISTORY` animation triggers and sound commands, each numbered
 * by that device. Only the device writes its row, so two devices firing at
 * once never share one, and every write carries the history, so a write the
 * outbox coalesced or a delta that folded several versions together still
 * delivers each event. Every other device fires the numbers past the last it
 * saw from that row. A welcome or snapshot only marks the rows seen, so a
 * device that joins or reconnects replays nothing and gets the resulting state
 * from the other rows. Rows of devices that left are removed by the room's
 * authority (see StudioSharedState).
 */
export declare class StudioEventRing {
    private host;
    private target;
    private unsubscribeSounds;
    /** This device's row: the peer id it is written under, and what it holds. */
    private ownPeer;
    private ownCount;
    private history;
    /** The newest event number fired or marked seen, per row. */
    private lastSeen;
    private arrivals;
    /** Events for a scene this device is on its way to, until it attaches. */
    private waiting;
    constructor(host: StudioEventHost);
    bind(target: StudioEventTarget | null): void;
    /** The row this device writes its events to. */
    ownRowId(): string;
    emit(event: StudioSharedEvent): void;
    /** An accepted write to `evt:<rowPeer>`, in the room's order. */
    receive(rowPeer: string, fields: Fields): void;
    /** A row whose events came in a welcome or snapshot: counted, not fired. */
    seen(rowPeer: string, fields: Fields): void;
    /** A row was deleted: its peer left, and a row under that id starts afresh. */
    forget(rowPeer: string): void;
    private deliver;
    dispose(): void;
    private fire;
}
export {};
