"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioDragStore = void 0;
const utils_1 = require("./utils");
function samePosition(a, b) {
    return a === b || (!!a && !!b && a.every((v, i) => v === b[i]));
}
/**
 * Per-scene drag state a shared session drives, keyed by asset placement id:
 * where another device dragged an asset (scene-frame coordinates) and whether
 * another device holds it now. Per-asset listeners, so a drag elsewhere
 * repaints the one node it moves rather than the scene.
 *
 * Drags on this device only pass through (`moved`). The renderer already moves
 * the node, and feeding its position back as a prop would pull it behind the
 * finger.
 */
class StudioDragStore {
    positions = new Map();
    locked = new Set();
    revisions = new Map();
    keyed = new utils_1.KeyedListeners();
    moves = new Set();
    getPosition(assetId) {
        return this.positions.get(assetId);
    }
    isLocked(assetId) {
        return this.locked.has(assetId);
    }
    /** Bumped by a forced apply that did not move the position. */
    revision(assetId) {
        return this.revisions.get(assetId) ?? 0;
    }
    subscribe(assetId, listener) {
        return this.keyed.subscribe(assetId, listener);
    }
    /**
     * Another device's drag. No position leaves the asset where the scene put
     * it. `force` repaints an unchanged position, for a node this device moved
     * itself while its drag was being refused.
     */
    applyRemote(assetId, position, locked, force = false) {
        const moved = !samePosition(this.positions.get(assetId), position);
        if (!moved && this.locked.has(assetId) === locked && !force)
            return;
        if (position)
            this.positions.set(assetId, position);
        else
            this.positions.delete(assetId);
        if (locked)
            this.locked.add(assetId);
        else
            this.locked.delete(assetId);
        if (force && !moved) {
            this.revisions.set(assetId, this.revision(assetId) + 1);
        }
        this.keyed.notify(assetId);
    }
    /** This device dragged the asset to a world position. */
    moved(assetId, worldPosition) {
        [...this.moves].forEach((fn) => fn(assetId, worldPosition));
    }
    subscribeMoves(listener) {
        this.moves.add(listener);
        return () => {
            this.moves.delete(listener);
        };
    }
    /** Every asset back where the scene puts it, held by nobody. */
    reset() {
        if (this.positions.size === 0 && this.locked.size === 0)
            return;
        this.positions.clear();
        this.locked.clear();
        this.revisions.clear();
        this.keyed.notifyAll();
    }
}
exports.StudioDragStore = StudioDragStore;
