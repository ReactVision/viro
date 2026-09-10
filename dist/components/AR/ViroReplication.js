/**
 * Copyright © 2026 ReactVision
 *
 * Replicated room state — ordering, conflict resolution and authority.
 *
 * The co-location channel (`ViroColocation`) relays poses and is lossy by
 * design: the next pose supersedes the last one 100 ms later. Application state
 * does not work that way — "the door is open" has to survive a dropped frame, a
 * late joiner and a reconnect — so it gets a different transport with different
 * guarantees.
 *
 * ## Where this runs, and why it is not the channel
 *
 * A separate WebSocket, opened from JS, against the same room id. Poses
 * originate in C++ at frame rate and must not cross the bridge; application
 * state originates in JS and must not be lossy. One socket for both would make
 * each pay the other's cost.
 *
 * ## What the server guarantees
 *
 * Total order. Every accepted change carries a sequence number, identical for
 * every client. A gap means a delta was missed, and this client asks for a
 * resync rather than carrying on with a hole in its state.
 *
 * ## Conflict resolution
 *
 * - `claim()` takes authority over an entity. While held, only the owner may
 *   change it — that is how two people grabbing the same object resolve.
 * - `expectVersion` opts a write into optimistic concurrency: if the entity
 *   moved on, the write is refused and the current value comes back.
 * - Unowned entities are last-writer-wins.
 * - A peer that disconnects releases whatever it held, so a crash mid-drag does
 *   not freeze an object.
 *
 * @providesModule ViroReplication
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroReplicationClient = void 0;
const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];
const DEFAULT_ENDPOINT = "https://platform.reactvision.xyz";
/** https:// → wss://, http:// → ws://. Anything else passes through. */
function toSocketScheme(endpoint) {
    if (endpoint.startsWith("https://"))
        return "wss://" + endpoint.slice(8);
    if (endpoint.startsWith("http://"))
        return "ws://" + endpoint.slice(7);
    return endpoint;
}
class ViroReplicationClient {
    ws = null;
    config = null;
    entities = new Map();
    lastSeq = -1;
    _state = "idle";
    _localPeerId = "";
    _error;
    attempt = 0;
    closedByUs = false;
    retryTimer;
    listeners = new Set();
    /**
     * Optimistic writes awaiting confirmation, by ref.
     *
     * `id` is stored separately from `before` because rolling back a *create*
     * has no previous value to restore — only an entity to remove — and without
     * the id there is nothing to remove it by.
     */
    pending = new Map();
    refCounter = 0;
    get state() {
        return this._state;
    }
    get localPeerId() {
        return this._localPeerId;
    }
    get error() {
        return this._error;
    }
    /** Snapshot of the current state. Safe to hold — it is a copy. */
    getEntities() {
        return [...this.entities.values()].map((e) => ({ ...e, fields: { ...e.fields } }));
    }
    get(id) {
        const e = this.entities.get(id);
        return e ? { ...e, fields: { ...e.fields } } : undefined;
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    connect(config) {
        this.disconnect();
        this.config = config;
        this.closedByUs = false;
        this.attempt = 0;
        this.open();
    }
    disconnect() {
        this.closedByUs = true;
        if (this.retryTimer)
            clearTimeout(this.retryTimer);
        this.retryTimer = undefined;
        if (this.ws) {
            // Detached first: the handlers would otherwise fire during close and
            // schedule a reconnect for a session the caller has abandoned.
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            try {
                this.ws.close();
            }
            catch {
                // Already closing; nothing to do.
            }
        }
        this.ws = null;
        this.entities.clear();
        this.pending.clear();
        this.lastSeq = -1;
        this._localPeerId = "";
        this.setState("idle");
    }
    // ── Operations ────────────────────────────────────────────────────────────
    /** Take authority. Creates the entity if it does not exist yet. */
    claim(id, opts = {}) {
        this.send({ op: "claim", id, expectVersion: opts.expectVersion });
    }
    release(id) {
        this.send({ op: "release", id });
    }
    /** Merge `fields` into the entity. Creates it if absent. */
    set(id, fields, opts = {}) {
        const ref = this.send({ op: "set", id, fields, expectVersion: opts.expectVersion });
        if (!opts.optimistic || !ref)
            return;
        // Remember what to restore if the server refuses, then show the change now.
        const before = this.entities.get(id);
        this.pending.set(ref, {
            id,
            before: before ? { ...before, fields: { ...before.fields } } : undefined,
        });
        const base = before ?? { id, fields: {}, version: 0, owner: null };
        this.entities.set(id, { ...base, fields: { ...base.fields, ...fields } });
        this.emit();
    }
    delete(id, opts = {}) {
        this.send({ op: "delete", id, expectVersion: opts.expectVersion });
    }
    // ── Socket ────────────────────────────────────────────────────────────────
    open() {
        const cfg = this.config;
        if (!cfg)
            return;
        const base = toSocketScheme(cfg.endpoint ?? DEFAULT_ENDPOINT);
        // Credentials go in the query string because the browser and React Native
        // WebSocket APIs cannot set request headers. See server/src/auth.ts.
        const url = `${base}/functions/v1/replication/${encodeURIComponent(cfg.roomId)}` +
            `?apiKey=${encodeURIComponent(cfg.apiKey)}` +
            `&projectId=${encodeURIComponent(cfg.projectId)}`;
        this.setState(this.attempt === 0 ? "connecting" : "reconnecting");
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => {
            this.attempt = 0;
            // State becomes synced on the welcome, not here: an open socket without a
            // snapshot has nothing to answer reads with.
            if (this.lastSeq >= 0)
                ws.send(JSON.stringify({ op: "resync", sinceSeq: this.lastSeq }));
        };
        ws.onmessage = (ev) => {
            if (typeof ev.data !== "string")
                return;
            let msg;
            try {
                msg = JSON.parse(ev.data);
            }
            catch {
                return;
            }
            this.handle(msg);
        };
        const dropped = () => {
            if (this.closedByUs || this.ws !== ws)
                return;
            this.ws = null;
            if (this.attempt >= BACKOFF_MS.length) {
                this._error = "replication socket gave up reconnecting";
                this.setState("failed");
                return;
            }
            const delay = BACKOFF_MS[this.attempt++];
            this.setState("reconnecting");
            this.retryTimer = setTimeout(() => this.open(), delay);
        };
        ws.onclose = dropped;
        ws.onerror = dropped;
    }
    handle(msg) {
        switch (msg.t) {
            case "welcome":
                this._localPeerId = String(msg.you ?? "");
                this.replaceAll(msg.entities, Number(msg.seq));
                this.setState("synced");
                return;
            case "snapshot":
                // Arrives when a resync gap exceeded the server's retained history.
                this.replaceAll(msg.entities, Number(msg.seq));
                this.setState("synced");
                return;
            case "delta":
                this.applyDeltas((msg.ops ?? []));
                return;
            case "reject":
                this.rollback(msg);
                return;
        }
    }
    replaceAll(entities, seq) {
        this.entities.clear();
        for (const e of entities ?? [])
            this.entities.set(e.id, e);
        this.lastSeq = Number.isFinite(seq) ? seq : -1;
        this.pending.clear();
        this.emit();
    }
    applyDeltas(ops) {
        for (const op of ops) {
            // A gap means a delta never arrived. Carrying on would leave this client
            // quietly describing state that no longer matches the room, so it stops
            // and asks for everything since what it does have.
            if (this.lastSeq >= 0 && op.seq > this.lastSeq + 1) {
                this.requestResync();
                return;
            }
            if (op.seq <= this.lastSeq)
                continue; // already applied
            if (op.kind === "upsert") {
                this.entities.set(op.entity.id, op.entity);
            }
            else if (op.kind === "delete") {
                this.entities.delete(op.id);
            }
            else if (op.kind === "owner") {
                const e = this.entities.get(op.id);
                if (e)
                    this.entities.set(op.id, { ...e, owner: op.owner, version: op.version });
                else
                    this.entities.set(op.id, { id: op.id, fields: {}, owner: op.owner, version: op.version });
            }
            this.lastSeq = op.seq;
        }
        this.pending.clear();
        this.emit();
    }
    requestResync() {
        if (this.ws?.readyState !== 1)
            return;
        this.ws.send(JSON.stringify({ op: "resync", sinceSeq: this.lastSeq }));
    }
    rollback(msg) {
        if (msg.ref && this.pending.has(msg.ref)) {
            const p = this.pending.get(msg.ref);
            this.pending.delete(msg.ref);
            // Prefer the server's current value over the local pre-write one: it is
            // newer, and it is what the caller needs in order to retry sensibly.
            if (msg.current) {
                this.entities.set(msg.current.id, msg.current);
            }
            else if (p.before) {
                this.entities.set(p.id, p.before);
            }
            else {
                // Refused create: the server has no such entity, so neither should we.
                this.entities.delete(p.id);
            }
            this.emit();
        }
        else if (msg.current) {
            this.entities.set(msg.current.id, msg.current);
            this.emit();
        }
        this.onReject?.({
            reason: msg.reason,
            current: msg.current,
        });
    }
    /** Called for every refused operation. */
    onReject;
    send(op) {
        if (this.ws?.readyState !== 1)
            return null;
        const ref = `r${++this.refCounter}`;
        const payload = { ...op, ref };
        if (payload.expectVersion === undefined)
            delete payload.expectVersion;
        this.ws.send(JSON.stringify(payload));
        return ref;
    }
    setState(s) {
        if (this._state === s)
            return;
        this._state = s;
        this.emit();
    }
    emit() {
        for (const fn of this.listeners)
            fn();
    }
}
exports.ViroReplicationClient = ViroReplicationClient;
