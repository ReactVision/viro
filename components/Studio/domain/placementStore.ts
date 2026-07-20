import { StudioAsset } from "../types";
import { GlobalListeners, KeyedListeners, isDev } from "./utils";

type Vec3 = [number, number, number];
type PlacementStatus = "unplaced" | "placed";

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
// lands exactly as authored relative to where the user was looking. Rotations
// use Viro's Euler convention: R = Rx·Ry·Rz, X-Y-Z order (VROMatrix4f).

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

/** Rotation matrix for an Euler triple (degrees), R = Rx·Ry·Rz. */
function eulerToMat(deg: Vec3): Mat3 {
  const ca = Math.cos(deg[0] * RAD),
    sa = Math.sin(deg[0] * RAD);
  const cb = Math.cos(deg[1] * RAD),
    sb = Math.sin(deg[1] * RAD);
  const cc = Math.cos(deg[2] * RAD),
    sc = Math.sin(deg[2] * RAD);
  return [
    [cb * cc, -cb * sc, sb],
    [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
    [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
  ];
}

/** Inverse of eulerToMat: recover the Euler triple (degrees) from R = Rx·Ry·Rz. */
function matToEuler(m: Mat3): Vec3 {
  const sb = Math.max(-1, Math.min(1, m[0][2]));
  const b = Math.asin(sb);
  let a: number;
  let c: number;
  if (Math.abs(m[0][2]) < 1 - 1e-6) {
    a = Math.atan2(-m[1][2], m[2][2]);
    c = Math.atan2(-m[0][1], m[0][0]);
  } else {
    // Gimbal lock (ry = ±90°): fold the roll into c = 0.
    c = 0;
    a = m[0][2] > 0 ? Math.atan2(m[1][0], m[1][1]) : Math.atan2(-m[1][0], m[1][1]);
  }
  return [a * DEG, b * DEG, c * DEG];
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
      if (!asset?.id || !asset.tap_to_place) continue;
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
      if (!asset?.id || !asset.tap_to_place) continue;
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
   * user was looking (R = camera · author, decomposed back to Viro's X-Y-Z Euler).
   * Falls back to the author rotation when no basis was captured. Undefined until
   * placed.
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
