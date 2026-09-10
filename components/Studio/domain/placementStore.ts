import { StudioAsset } from "../types";
import { GlobalListeners, KeyedListeners, isDev } from "./utils";

type Vec3 = [number, number, number];
type PlacementStatus = "unplaced" | "placed";

/**
 * Image triggering wins over tap-to-place: a marker both triggers its content and
 * anchors it, since the node is a child of `ViroARImageMarker` and follows the
 * marker, so there is nothing left for a tap to decide. `StudioARScene` splits the
 * scene on that rule already; this is the same rule for the two places that gate a
 * single asset, the placement queue below and the node factory's `PlaceableNode`
 * wrap, which used to withhold such an asset until a tap and then hand it world
 * coordinates inside the marker's frame.
 */
export function isTapToPlaceAsset(
  asset: StudioAsset | null | undefined
): boolean {
  return !!asset?.tap_to_place && !asset.trigger_image_url;
}

/**
 * Tap-to-place assets in author-defined queue order: ascending tap_to_place_order,
 * nulls last (an older backend that omits the field keeps its incoming load order
 * via the stable sort). Copies first — the caller's array is memoised React state.
 */
function byPlacementOrder(assets: StudioAsset[]): StudioAsset[] {
  return [...assets].sort((a, b) => {
    const ao = a.tap_to_place_order ?? Infinity;
    const bo = b.tap_to_place_order ?? Infinity;
    return ao === bo ? 0 : ao - bo;
  });
}

// ─── Tap-time orientation math ──────────────────────────────────────────────
// A placed asset's author position/rotation are expressed in the FULL camera
// basis at the moment of the tap (pitch and roll included), so the placement
// lands exactly as authored relative to where the user was looking.
//
// Rotations compose the way the renderer applies a node's euler triple, R =
// Rz·Ry·Rx: X first, then Y, then Z, about the fixed world axes. Composing them
// in the opposite order and handing the result to a renderer that reads it this
// way turns the same numbers into a different orientation, and only agrees when
// two of the three angles are zero, which is why a level camera looked right.

type Mat3 = [Vec3, Vec3, Vec3]; // row-major
const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 | null {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-6 ? [v[0] / l, v[1] / l, v[2] / l] : null;
}

function applyMat(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function multiplyMat(a: Mat3, b: Mat3): Mat3 {
  const r: Mat3 = [
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
function eulerToMat(deg: Vec3): Mat3 {
  const cx = Math.cos(deg[0] * RAD),
    sx = Math.sin(deg[0] * RAD);
  const cy = Math.cos(deg[1] * RAD),
    sy = Math.sin(deg[1] * RAD);
  const cz = Math.cos(deg[2] * RAD),
    sz = Math.sin(deg[2] * RAD);
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}

/** Inverse of eulerToMat: recover the Euler triple (degrees) from R = Rz·Ry·Rx. */
function matToEuler(m: Mat3): Vec3 {
  const cy = Math.hypot(m[0][0], m[1][0]);
  const y = Math.atan2(-m[2][0], cy);
  let x: number;
  let z: number;
  if (cy > 1e-6) {
    x = Math.atan2(m[2][1], m[2][2]);
    z = Math.atan2(m[1][0], m[0][0]);
  } else {
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
function cameraBasis(forward?: Vec3, up?: Vec3): Mat3 | null {
  if (!forward || !up) return null;
  const f = normalize(forward);
  const u0 = normalize(up);
  if (!f || !u0) return null;
  const right = normalize(cross(f, u0));
  if (!right) return null;
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
export class StudioPlacementStore {
  private status = new Map<string, PlacementStatus>();
  private positions = new Map<string, Vec3>();
  // Full camera orientation (rotation matrix) at tap time per placement, so the
  // author position and rotation resolve in the frame the user was looking in.
  private bases = new Map<string, Mat3>();
  private order: string[] = [];
  private keyed = new KeyedListeners();
  private active = new GlobalListeners();

  /** Initialise-if-absent from the tap_to_place flag (idempotent, strict-mode safe). */
  seed(assets: StudioAsset[]): void {
    for (const asset of byPlacementOrder(assets)) {
      if (!asset?.id || !isTapToPlaceAsset(asset)) continue;
      if (this.status.has(asset.id)) continue;
      this.status.set(asset.id, "unplaced");
      this.order.push(asset.id);
    }
  }

  /** Re-initialise for a new scene, then wake every subscriber. */
  reseed(assets: StudioAsset[]): void {
    this.status.clear();
    this.positions.clear();
    this.bases.clear();
    this.order = [];
    for (const asset of byPlacementOrder(assets)) {
      if (!asset?.id || !isTapToPlaceAsset(asset)) continue;
      this.status.set(asset.id, "unplaced");
      this.order.push(asset.id);
    }
    this.keyed.notifyAll();
    this.active.notify();
  }

  /** True for assets this store gates (tap_to_place). */
  isTracked(assetId: string): boolean {
    return this.status.has(assetId);
  }

  isPlaced(assetId: string): boolean {
    return this.status.get(assetId) === "placed";
  }

  getPosition(assetId: string): Vec3 | undefined {
    return this.positions.get(assetId);
  }

  /**
   * Placed world position with the author position applied as an offset in the
   * full tap-time camera frame: +X = the user's right, +Y = their up, +Z = toward
   * them, all including the camera's pitch and roll when they tapped (matching the
   * editor's default-view gizmo axes when level). Falls back to a plain world-axis
   * add when no basis was captured. Undefined until placed.
   */
  resolvePlacedPosition(assetId: string, offset: Vec3): Vec3 | undefined {
    const p = this.positions.get(assetId);
    if (!p) return undefined;
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
  resolvePlacedRotation(assetId: string, rotation: Vec3): Vec3 | undefined {
    if (!this.positions.has(assetId)) return undefined;
    const basis = this.bases.get(assetId);
    if (!basis) return rotation;
    return matToEuler(multiplyMat(basis, eulerToMat(rotation)));
  }

  /** First still-unplaced asset in seed order, or null once all are placed. */
  activeAssetId(): string | null {
    for (const id of this.order) {
      if (this.status.get(id) === "unplaced") return id;
    }
    return null;
  }

  /**
   * Record a placement at a tap point, with the camera forward/up at tap time so
   * the author position and rotation resolve in the user's full tap-time frame.
   * No-op if the asset is untracked or already placed.
   */
  place(assetId: string, position: Vec3, forward?: Vec3, up?: Vec3): void {
    if (this.status.get(assetId) !== "unplaced") return;
    this.status.set(assetId, "placed");
    this.positions.set(assetId, position);
    const basis = cameraBasis(forward, up);
    if (basis) this.bases.set(assetId, basis);
    if (isDev()) {
      console.log(`[Studio] Placed "${assetId}" at`, position);
    }
    this.keyed.notify(assetId);
    this.active.notify();
  }

  /** Subscribe to one asset's placement changes; returns an unsubscribe fn. */
  subscribe(assetId: string, listener: () => void): () => void {
    return this.keyed.subscribe(assetId, listener);
  }

  /** Subscribe to active-asset changes (the placement UI); returns unsubscribe. */
  subscribeActive(listener: () => void): () => void {
    return this.active.subscribe(listener);
  }
}
