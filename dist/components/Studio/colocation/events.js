"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioEventRing = exports.STUDIO_EVENT_WAIT_MS = exports.STUDIO_EVENT_HISTORY = exports.STUDIO_EVENT_PREFIX = void 0;
exports.sceneAudioUrls = sceneAudioUrls;
const frameMath_1 = require("./frameMath");
exports.STUDIO_EVENT_PREFIX = "evt:";
/** Events each device's row keeps, so a batched or coalesced write loses none. */
exports.STUDIO_EVENT_HISTORY = 8;
/** How long an event for a scene this device is still loading waits for it. */
exports.STUDIO_EVENT_WAIT_MS = 10000;
const MAX_DEPTH = 16;
/** Every clip a scene's functions can play, however deeply nested. */
function sceneAudioUrls(sceneData) {
    const urls = new Set();
    const visitSequence = (sequence, depth) => {
        for (const step of sequence?.steps ?? [])
            visit(step.function, depth + 1);
    };
    const visit = (fn, depth) => {
        if (!fn || depth > MAX_DEPTH)
            return;
        if (fn.scene_sound?.audio_url)
            urls.add(fn.scene_sound.audio_url);
        visitSequence(fn.scene_sequence, depth);
        for (const condition of fn.scene_branch?.conditions ?? []) {
            visitSequence(condition.sequence, depth);
        }
        visitSequence(fn.scene_branch?.no_match_sequence, depth);
        for (const lane of fn.scene_group?.lanes ?? []) {
            visitSequence(lane.sequence, depth);
        }
        visitSequence(fn.scene_api_request?.success_sequence, depth);
        visitSequence(fn.scene_api_request?.failure_sequence, depth);
    };
    for (const fn of sceneData?.functions ?? [])
        visit(fn, 0);
    for (const asset of sceneData?.assets ?? [])
        visit(asset?.scene_function, 0);
    for (const binding of [
        ...(sceneData?.collision_bindings ?? []),
        ...(sceneData?.proximity_bindings ?? []),
        ...(sceneData?.gaze_bindings ?? []),
    ]) {
        visit(binding?.scene_function, 0);
    }
    return urls;
}
/**
 * Every key the event's kind has, nulls included: a set merges into whatever
 * the slot held before, and a key left out would keep an older event's value.
 */
function encode(event) {
    switch (event.kind) {
        case "animation":
            return {
                kind: "animation",
                sceneId: event.sceneId,
                assetId: event.assetId,
                key: event.key,
            };
        case "sound":
            return event.action === "play"
                ? {
                    kind: "sound",
                    sceneId: event.sceneId,
                    action: "play",
                    audioAssetId: event.audioAssetId,
                    url: event.url,
                    position: event.position ?? null,
                    volume: event.volume,
                    loop: event.loop,
                    stopOthers: event.stopOthers,
                }
                : {
                    kind: "sound",
                    sceneId: event.sceneId,
                    action: "stop",
                    audioAssetId: event.audioAssetId,
                };
        default: {
            const unknown = event;
            throw new Error(`Unknown shared event ${JSON.stringify(unknown)}`);
        }
    }
}
function decode(fields) {
    const { kind, sceneId } = fields;
    if (typeof sceneId !== "string")
        return null;
    if (kind === "animation") {
        const { assetId, key } = fields;
        if (typeof assetId !== "string" || typeof key !== "string")
            return null;
        return { kind, sceneId, assetId, key };
    }
    if (kind !== "sound")
        return null;
    if (fields.action === "stop") {
        const { audioAssetId } = fields;
        if (audioAssetId !== null && typeof audioAssetId !== "string")
            return null;
        return { kind, sceneId, action: "stop", audioAssetId };
    }
    const { audioAssetId, url, position, volume, loop, stopOthers } = fields;
    if (fields.action !== "play" ||
        typeof audioAssetId !== "string" ||
        typeof url !== "string" ||
        typeof volume !== "number" ||
        !Number.isFinite(volume) ||
        typeof loop !== "boolean" ||
        typeof stopOthers !== "boolean" ||
        (position !== null && !(0, frameMath_1.isVec3)(position))) {
        return null;
    }
    return {
        kind,
        sceneId,
        action: "play",
        audioAssetId,
        url,
        ...(position ? { position } : {}),
        volume,
        loop,
        stopOthers,
    };
}
function eventNumber(fields) {
    const { s } = fields;
    return typeof s === "number" && Number.isFinite(s) ? s : null;
}
/** A row's events, oldest first, each with its number. */
function rowEvents(fields) {
    const list = Array.isArray(fields.events) ? fields.events : [];
    const out = [];
    for (const item of list) {
        if (!item || typeof item !== "object")
            continue;
        const n = eventNumber(item);
        if (n !== null)
            out.push({ s: n, fields: item });
    }
    return out.sort((a, b) => a.s - b.s);
}
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
class StudioEventRing {
    host;
    target = null;
    unsubscribeSounds = null;
    /** This device's row: the peer id it is written under, and what it holds. */
    ownPeer = "";
    ownCount = 0;
    history = [];
    /** The newest event number fired or marked seen, per row. */
    lastSeen = new Map();
    arrivals = 0;
    /** Events for a scene this device is on its way to, until it attaches. */
    waiting = [];
    constructor(host) {
        this.host = host;
    }
    bind(target) {
        const sounds = target?.sounds ?? null;
        if (sounds !== (this.target?.sounds ?? null)) {
            this.unsubscribeSounds?.();
            this.unsubscribeSounds = sounds
                ? sounds.subscribeCommands((command, origin) => {
                    const sceneId = this.target?.sceneId;
                    if (origin === "local" && sceneId) {
                        this.emit({ kind: "sound", sceneId, ...command });
                    }
                })
                : null;
        }
        this.target = target;
        if (!target)
            return;
        const cutoff = this.host.now() - exports.STUDIO_EVENT_WAIT_MS;
        const due = this.waiting
            .filter((w) => w.event.sceneId === target.sceneId && w.at >= cutoff)
            .sort((a, b) => a.n - b.n);
        this.waiting = [];
        due.forEach((w) => this.fire(target, w.event));
    }
    /** The row this device writes its events to. */
    ownRowId() {
        return exports.STUDIO_EVENT_PREFIX + this.host.localPeerId();
    }
    emit(event) {
        if (!this.host.isSynced())
            return;
        const peer = this.host.localPeerId();
        if (peer !== this.ownPeer) {
            // A new connection is a new row; the old one goes with the old peer id.
            this.ownPeer = peer;
            this.ownCount = 0;
            this.history = [];
        }
        const s = ++this.ownCount;
        this.history = this.history
            .concat({ ...encode(event), s })
            .slice(-exports.STUDIO_EVENT_HISTORY);
        this.host.write(exports.STUDIO_EVENT_PREFIX + peer, { events: this.history });
    }
    /** An accepted write to `evt:<rowPeer>`, in the room's order. */
    receive(rowPeer, fields) {
        if (rowPeer === this.host.localPeerId())
            return;
        const last = this.lastSeen.get(rowPeer) ?? 0;
        const fresh = rowEvents(fields).filter((e) => e.s > last);
        if (fresh.length === 0)
            return;
        this.lastSeen.set(rowPeer, fresh[fresh.length - 1].s);
        for (const { fields: item } of fresh) {
            const event = decode(item);
            if (event)
                this.deliver(event);
        }
    }
    /** A row whose events came in a welcome or snapshot: counted, not fired. */
    seen(rowPeer, fields) {
        const events = rowEvents(fields);
        if (events.length === 0)
            return;
        const newest = events[events.length - 1].s;
        this.lastSeen.set(rowPeer, Math.max(this.lastSeen.get(rowPeer) ?? 0, newest));
    }
    /** A row was deleted: its peer left, and a row under that id starts afresh. */
    forget(rowPeer) {
        this.lastSeen.delete(rowPeer);
    }
    deliver(event) {
        const target = this.target;
        if (target && event.sceneId === target.sceneId) {
            this.fire(target, event);
            return;
        }
        const cutoff = this.host.now() - exports.STUDIO_EVENT_WAIT_MS;
        this.waiting = this.waiting
            .filter((w) => w.at >= cutoff)
            .concat({ event, n: ++this.arrivals, at: this.host.now() })
            .slice(-exports.STUDIO_EVENT_HISTORY * 2);
    }
    dispose() {
        this.unsubscribeSounds?.();
        this.unsubscribeSounds = null;
        this.target = null;
        this.waiting = [];
    }
    fire(target, event) {
        switch (event.kind) {
            case "animation":
                target.playAnimation?.(event.assetId, event.key);
                return;
            case "sound": {
                const sounds = target.sounds;
                if (!sounds)
                    return;
                if (event.action === "stop") {
                    sounds.stop(event.audioAssetId, "remote");
                    return;
                }
                // Any peer can write a slot, and a PLAY has every device fetch its
                // URL, so only a clip the scene itself plays is played.
                if (!target.audioUrls.has(event.url))
                    return;
                sounds.play({
                    audioAssetId: event.audioAssetId,
                    url: event.url,
                    position: event.position,
                    volume: event.volume,
                    loop: event.loop,
                    stopOthers: event.stopOthers,
                }, undefined, "remote");
                return;
            }
            default: {
                const unknown = event;
                console.warn(`[Studio] Unknown shared event ${JSON.stringify(unknown)}`);
            }
        }
    }
}
exports.StudioEventRing = StudioEventRing;
