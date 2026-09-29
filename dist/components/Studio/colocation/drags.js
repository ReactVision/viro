"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioDragBridge = exports.STUDIO_DRAG_IDLE_MS = exports.STUDIO_DRAG_PREFIX = void 0;
const useViroThrottledWrite_1 = require("../../hooks/useViroThrottledWrite");
const frameMath_1 = require("./frameMath");
exports.STUDIO_DRAG_PREFIX = "drag:";
/**
 * The renderer reports a drag's moves and never its end, so this long without
 * a move ends it. Longer than a pause mid-drag, since the end gives up the claim.
 */
exports.STUDIO_DRAG_IDLE_MS = 500;
function sameVec(a, b) {
    return !!b && a.every((v, i) => v === b[i]);
}
/**
 * `drag:<assetId>` = `{ p }` in the location frame. A drag here claims the row
 * at its first move, writes the position at most once per write interval and
 * releases the row when it ends; while another device holds a row this device
 * cannot drag that asset. The relay releases a departed peer's rows itself.
 *
 * Rows are applied to the scene's drag store, never to scene state, so a drag
 * elsewhere repaints only the node it moves.
 */
class StudioDragBridge {
    host;
    intervalMs;
    idleMs;
    store = null;
    unsubscribe = null;
    shareable = new Set();
    drags = new Map();
    /** This device's last write per asset: its echo is where the node already is. */
    written = new Map();
    constructor(host, intervalMs = useViroThrottledWrite_1.VIRO_REPLICATION_WRITE_INTERVAL_MS, idleMs = exports.STUDIO_DRAG_IDLE_MS) {
        this.host = host;
        this.intervalMs = intervalMs;
        this.idleMs = idleMs;
    }
    /** Draggable assets outside image markers, whose content stays per device. */
    bind(store, sceneData) {
        if (store !== this.store) {
            // The scene these drags were in is gone, and its rows with it.
            [...this.drags.keys()].forEach((assetId) => this.end(assetId, true));
            this.unsubscribe?.();
            this.unsubscribe = store ? store.subscribeMoves(this.onMove) : null;
            this.store = store;
        }
        this.shareable = new Set((sceneData?.assets ?? [])
            .filter((a) => a?.is_draggable && !a.trigger_image_url)
            .map((a) => a.id));
        if (this.host.isSynced())
            this.adoptAll();
    }
    receive(assetId, entity) {
        const drag = this.drags.get(assetId);
        // This device's own drag: the node is under the finger already.
        if (drag && !drag.refused)
            return;
        this.applyRow(assetId, entity, false);
    }
    removed(assetId) {
        this.written.delete(assetId);
        if (this.shareable.has(assetId)) {
            this.store?.applyRemote(assetId, undefined, false);
        }
    }
    rejected(assetId, reason, current) {
        if (reason !== "already-owned" && reason !== "not-owner")
            return;
        const drag = this.drags.get(assetId);
        if (drag) {
            drag.refused = true;
            drag.pending = null;
            if (drag.writeTimer)
                clearTimeout(drag.writeTimer);
            drag.writeTimer = null;
            this.applyRow(assetId, current, false);
            return;
        }
        // A drag too short to hear its refusal moved the node here alone.
        this.applyRow(assetId, current, true);
    }
    sync() {
        this.adoptAll();
    }
    /** The scene origin changed, so every row converts differently. */
    refresh() {
        if (this.host.isSynced())
            this.adoptAll();
    }
    /** The relay released this device's rows with its socket. */
    unsynced() {
        this.drags.forEach((drag) => this.stopTimers(drag));
        this.drags.clear();
    }
    dispose() {
        this.unsynced();
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.store = null;
        this.written.clear();
    }
    onMove = (assetId, world) => {
        if (!this.host.isSynced() || !this.shareable.has(assetId))
            return;
        const toLocation = this.host.worldToLocation();
        if (!toLocation || !this.host.origin())
            return;
        let drag = this.drags.get(assetId);
        if (!drag) {
            // Held elsewhere, so a move that raced the lock: the renderer moved the
            // node anyway, and it goes back when the drag ends, as a refused one does.
            const refused = !!this.store?.isLocked(assetId);
            drag = {
                pending: null,
                lastSentAt: -Infinity,
                writeTimer: null,
                idleTimer: null,
                refused,
            };
            this.drags.set(assetId, drag);
            if (!refused)
                this.host.claim(exports.STUDIO_DRAG_PREFIX + assetId);
        }
        if (drag.idleTimer)
            clearTimeout(drag.idleTimer);
        drag.idleTimer = setTimeout(() => this.end(assetId, false), this.idleMs);
        if (drag.refused)
            return;
        drag.pending = (0, frameMath_1.transformPoint)(toLocation, world);
        this.schedule(assetId, drag);
    };
    schedule(assetId, drag) {
        if (drag.writeTimer || !drag.pending)
            return;
        const wait = drag.lastSentAt + this.intervalMs - this.host.now();
        if (wait <= 0) {
            this.send(assetId, drag);
            return;
        }
        drag.writeTimer = setTimeout(() => {
            drag.writeTimer = null;
            this.send(assetId, drag);
        }, wait);
    }
    send(assetId, drag) {
        const p = drag.pending;
        if (!p || drag.refused || !this.host.isSynced())
            return;
        drag.pending = null;
        drag.lastSentAt = this.host.now();
        this.written.set(assetId, p);
        this.host.set(exports.STUDIO_DRAG_PREFIX + assetId, { p });
    }
    /** The last position goes out before the release, which the relay orders after it. */
    end(assetId, sceneGone) {
        const drag = this.drags.get(assetId);
        if (!drag)
            return;
        this.drags.delete(assetId);
        this.stopTimers(drag);
        if (!this.host.isSynced())
            return;
        const id = exports.STUDIO_DRAG_PREFIX + assetId;
        if (drag.refused) {
            if (!sceneGone)
                this.applyRow(assetId, this.host.entity(id), true);
            return;
        }
        if (sceneGone) {
            this.written.delete(assetId);
            this.host.remove(id);
            return;
        }
        this.send(assetId, drag);
        this.host.release(id);
    }
    stopTimers(drag) {
        if (drag.writeTimer)
            clearTimeout(drag.writeTimer);
        if (drag.idleTimer)
            clearTimeout(drag.idleTimer);
        drag.writeTimer = null;
        drag.idleTimer = null;
    }
    adoptAll() {
        const present = new Set();
        for (const entity of this.host.entities(exports.STUDIO_DRAG_PREFIX)) {
            const assetId = entity.id.slice(exports.STUDIO_DRAG_PREFIX.length);
            present.add(assetId);
            this.receive(assetId, entity);
        }
        this.shareable.forEach((assetId) => {
            if (!present.has(assetId) && !this.drags.has(assetId)) {
                this.removed(assetId);
            }
        });
    }
    /**
     * `force` repaints the room's position even where it has not changed: the
     * node was moved natively by a drag the room refused.
     */
    applyRow(assetId, entity, force) {
        const store = this.store;
        if (!store || !this.shareable.has(assetId))
            return;
        const owner = entity?.owner ?? null;
        const locked = owner !== null && owner !== this.host.localPeerId();
        const raw = entity?.fields.p;
        const p = (0, frameMath_1.isVec3)(raw) ? raw : null;
        let position = store.getPosition(assetId);
        if (p && (force || !sameVec(p, this.written.get(assetId)))) {
            const origin = this.host.origin();
            const inverse = origin ? (0, frameMath_1.invert)(origin) : null;
            if (!inverse)
                return;
            position = (0, frameMath_1.transformPoint)(inverse, p);
        }
        store.applyRemote(assetId, position, locked, force);
    }
}
exports.StudioDragBridge = StudioDragBridge;
