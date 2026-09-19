"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioPlacementStore = void 0;
exports.isTapToPlaceAsset = isTapToPlaceAsset;
const utils_1 = require("./utils");
/**
 * Image triggering wins over tap-to-place: a marker both triggers its content and
 * anchors it, since the node is a child of `ViroARImageMarker` and follows the
 * marker, so there is nothing left for a tap to decide. `StudioARScene` splits the
 * scene on that rule already; this is the same rule for the two places that gate a
 * single asset, the placement queue below and the node factory's `PlaceableNode`
 * wrap, which used to withhold such an asset until a tap and then hand it world
 * coordinates inside the marker's frame.
 */
function isTapToPlaceAsset(asset) {
    return !!asset?.tap_to_place && !asset.trigger_image_url;
}
/**
 * Tap-to-place assets in author-defined queue order: ascending tap_to_place_order,
 * nulls last (an older backend that omits the field keeps its incoming load order
 * via the stable sort). Copies first — the caller's array is memoised React state.
 */
function byPlacementOrder(assets) {
    return [...assets].sort((a, b) => {
        const ao = a.tap_to_place_order ?? Infinity;
        const bo = b.tap_to_place_order ?? Infinity;
        return ao === bo ? 0 : ao - bo;
    });
}
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}
function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}
function applyMat(m, v) {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
}
function multiplyMat(a, b) {
    const r = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    return r;
}
/** Rotation matrix for an Euler triple (degrees), R = Rz·Ry·Rx. */
function eulerToMat(deg) {
    const cx = Math.cos(deg[0] * RAD), sx = Math.sin(deg[0] * RAD);
    const cy = Math.cos(deg[1] * RAD), sy = Math.sin(deg[1] * RAD);
    const cz = Math.cos(deg[2] * RAD), sz = Math.sin(deg[2] * RAD);
    return [
        [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
        [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
        [-sy, cy * sx, cy * cx],
    ];
}
/** Inverse of eulerToMat: recover the Euler triple (degrees) from R = Rz·Ry·Rx. */
function matToEuler(m) {
    const cy = Math.hypot(m[0][0], m[1][0]);
    const y = Math.atan2(-m[2][0], cy);
    let x;
    let z;
    if (cy > 1e-6) {
        x = Math.atan2(m[2][1], m[2][2]);
        z = Math.atan2(m[1][0], m[0][0]);
    }
    else {
        // Gimbal lock (ry = ±90°): X and Z turn about the same axis, so fold them
        // into Z, which is where VROQuaternion::toEuler puts them too.
        x = 0;
        z = Math.atan2(-m[0][1], m[1][1]);
    }
    return [x * DEG, y * DEG, z * DEG];
}
/**
 * Camera rotation matrix from its world forward/up vectors — columns are the
 * camera's right, up, and backward (−forward) axes, re-orthonormalised. Null if
 * either vector is missing or they are parallel (no valid basis).
 */
function cameraBasis(forward, up) {
    if (!forward || !up)
        return null;
    const f = normalize(forward);
    const u0 = normalize(up);
    if (!f || !u0)
        return null;
    const right = normalize(cross(f, u0));
    if (!right)
        return null;
    const u = cross(right, f); // re-orthonormalised (unit, ⊥ right and f)
    return [
        [right[0], u[0], -f[0]],
        [right[1], u[1], -f[1]],
        [right[2], u[2], -f[2]],
    ];
}
/**
 * Per-scene store for tap-to-place assets, keyed by asset placement id. A
 * tap-to-place asset is withheld from the scene until the end user places it,
 * then rendered at the placed world position. Placement is ephemeral runtime
 * state: nothing is persisted, so reopening the scene starts unplaced again.
 *
 * Two listener sets: per-asset (a placement repaints only that node) and a
 * global one (the placement UI re-reads which asset is active). Placement is
 * a guided queue — one asset at a time, in author-defined order.
 */
class StudioPlacementStore {
    status = new Map();
    positions = new Map();
    // Full camera orientation (rotation matrix) at tap time per placement, so the
    // author position and rotation resolve in the frame the user was looking in.
    bases = new Map();
    order = [];
    keyed = new utils_1.KeyedListeners();
    active = new utils_1.GlobalListeners();
    /** Initialise-if-absent from the tap_to_place flag (idempotent, strict-mode safe). */
    seed(assets) {
        for (const asset of byPlacementOrder(assets)) {
            if (!asset?.id || !isTapToPlaceAsset(asset))
                continue;
            if (this.status.has(asset.id))
                continue;
            this.status.set(asset.id, "unplaced");
            this.order.push(asset.id);
        }
    }
    /** Re-initialise for a new scene, then wake every subscriber. */
    reseed(assets) {
        this.status.clear();
        this.positions.clear();
        this.bases.clear();
        this.order = [];
        for (const asset of byPlacementOrder(assets)) {
            if (!asset?.id || !isTapToPlaceAsset(asset))
                continue;
            this.status.set(asset.id, "unplaced");
            this.order.push(asset.id);
        }
        this.keyed.notifyAll();
        this.active.notify();
    }
    /** True for assets this store gates (tap_to_place). */
    isTracked(assetId) {
        return this.status.has(assetId);
    }
    isPlaced(assetId) {
        return this.status.get(assetId) === "placed";
    }
    getPosition(assetId) {
        return this.positions.get(assetId);
    }
    /**
     * Placed world position with the author position applied as an offset in the
     * full tap-time camera frame: +X = the user's right, +Y = their up, +Z = toward
     * them, all including the camera's pitch and roll when they tapped (matching the
     * editor's default-view gizmo axes when level). Falls back to a plain world-axis
     * add when no basis was captured. Undefined until placed.
     */
    resolvePlacedPosition(assetId, offset) {
        const p = this.positions.get(assetId);
        if (!p)
            return undefined;
        const basis = this.bases.get(assetId);
        const w = basis ? applyMat(basis, offset) : offset;
        return [p[0] + w[0], p[1] + w[1], p[2] + w[2]];
    }
    /**
     * Author rotation (Euler degrees) composed with the full tap-time camera
     * orientation, so the asset is oriented exactly as authored relative to how the
     * user was looking (R = camera · author, decomposed back to the euler triple
     * the renderer reads). Falls back to the author rotation when no basis was
     * captured. Undefined until placed.
     */
    resolvePlacedRotation(assetId, rotation) {
        if (!this.positions.has(assetId))
            return undefined;
        const basis = this.bases.get(assetId);
        if (!basis)
            return rotation;
        return matToEuler(multiplyMat(basis, eulerToMat(rotation)));
    }
    /** First still-unplaced asset in seed order, or null once all are placed. */
    activeAssetId() {
        for (const id of this.order) {
            if (this.status.get(id) === "unplaced")
                return id;
        }
        return null;
    }
    /**
     * Record a placement at a tap point, with the camera forward/up at tap time so
     * the author position and rotation resolve in the user's full tap-time frame.
     * No-op if the asset is untracked or already placed.
     */
    place(assetId, position, forward, up) {
        if (this.status.get(assetId) !== "unplaced")
            return;
        this.status.set(assetId, "placed");
        this.positions.set(assetId, position);
        const basis = cameraBasis(forward, up);
        if (basis)
            this.bases.set(assetId, basis);
        if ((0, utils_1.isDev)()) {
            console.log(`[Studio] Placed "${assetId}" at`, position);
        }
        this.keyed.notify(assetId);
        this.active.notify();
    }
    /** Subscribe to one asset's placement changes; returns an unsubscribe fn. */
    subscribe(assetId, listener) {
        return this.keyed.subscribe(assetId, listener);
    }
    /** Subscribe to active-asset changes (the placement UI); returns unsubscribe. */
    subscribeActive(listener) {
        return this.active.subscribe(listener);
    }
}
exports.StudioPlacementStore = StudioPlacementStore;
