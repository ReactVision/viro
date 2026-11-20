/**
 * Dragging nodes on the web (`dragType`, `onDrag`).
 *
 * The renderer reports where a press hit a node but has no drag events and no
 * way to read the camera back, so whatever drives the camera publishes its view
 * here (the AR session, the desktop virtual camera, and the 3D navigators'
 * default camera), and a drag turns pointer positions into world rays itself.
 */
import type { ViroArSession, ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { conjugateQuat, multiplyQuats, quatFromEulerDegrees, rotateByQuaternion } from "./viroMath";

export type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

/** The camera as the renderer was last given it: pose, and intrinsics in `element`'s CSS pixels. */
export type CameraView = {
  position: Vec3;
  orientation: Quat;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  element: HTMLElement;
  /** An AR pose (a session, or the desktop stand-in): it turns whatever camera draws, so a camera node's own pose is not the view. */
  ar?: true;
};

const views = new WeakMap<ViroSceneApi, CameraView>();

/**
 * The scene's camera components, as native's ViroActiveCameraTracker keeps
 * them: the last one activated is the point of view, and releasing it goes
 * back to the default camera, never to an earlier one.
 */
type SceneCameras = { active: ViroHandle | null; orthographic: Set<ViroHandle>; fallback: ViroHandle };
const sceneCameras = new WeakMap<ViroSceneApi, SceneCameras>();

function camerasOf(scene: ViroSceneApi): SceneCameras {
  let cams = sceneCameras.get(scene);
  if (!cams) sceneCameras.set(scene, (cams = { active: null, orthographic: new Set(), fallback: 0 }));
  return cams;
}

export function setCameraView(scene: ViroSceneApi, view: CameraView | null): void {
  if (view) views.set(scene, view);
  else views.delete(scene);
}

/**
 * The camera the scene draws from. Under a ViroCamera or ViroOrbitCamera that
 * is the camera node's last drawn pose, with the default camera's field of
 * view, which is the one virocore gives it; null while that pose is not known
 * yet, on a renderer without the read, and under an orthographic projection.
 */
export function cameraView(scene: ViroSceneApi): CameraView | null {
  const base = views.get(scene) ?? null;
  const active = sceneCameras.get(scene)?.active;
  if (!active) return base;
  if (!base || base.ar || sceneCameras.get(scene)!.orthographic.has(active)) return null;
  const t = typeof scene.getNodeWorldTransform === "function" ? scene.getNodeWorldTransform(active) : null;
  // All zero until the node has been drawn once.
  if (!t || t.scale.every((c) => c === 0)) return null;
  const view = defaultCameraView(base.element);
  view.position = t.position;
  view.orientation = quatFromEulerDegrees(t.rotation);
  return view;
}

/** True while a camera component draws whose pose the web cannot report: orthographic, in AR, or on a renderer without the read. */
export function sceneCameraUnreadable(scene: ViroSceneApi): boolean {
  const cams = sceneCameras.get(scene);
  if (!cams?.active) return false;
  const base = views.get(scene);
  return (
    cams.orthographic.has(cams.active) ||
    !!base?.ar ||
    typeof scene.getNodeWorldTransform !== "function"
  );
}

/**
 * Makes a camera component's node the point of view until the returned
 * release, which returns to the default camera if this one still draws.
 */
export function activateSceneCamera(scene: ViroSceneApi, node: ViroHandle): () => void {
  const cams = camerasOf(scene);
  cams.active = node;
  scene.setActiveCameraNode(node);
  return () => {
    if (cams.active !== node) return;
    cams.active = null;
    if (cams.fallback) scene.setActiveCameraNode(cams.fallback);
  };
}

export function setSceneCameraOrthographic(scene: ViroSceneApi, node: ViroHandle, orthographic: boolean): void {
  const set = camerasOf(scene).orthographic;
  if (orthographic) set.add(node);
  else set.delete(node);
}

/**
 * A camera at the origin looking down -Z under `root`, which is virocore's
 * default and what a released camera component returns to: the renderer's own
 * default camera has no handle to return to.
 */
export function installDefaultCamera(scene: ViroSceneApi, root: ViroHandle): () => void {
  const node = scene.createNode();
  scene.setNodeCamera(node);
  scene.addChildNode(root, node);
  const cams = camerasOf(scene);
  cams.fallback = node;
  return () => {
    if (cams.fallback === node) cams.fallback = 0;
    scene.removeNodeFromParent(node);
    scene.destroyNode(node);
  };
}

/** virocore's default camera: at the origin, looking down -Z, 90 degrees across the longer axis (kFovMonoMajor). */
export function defaultCameraView(element: HTMLElement): CameraView {
  const focal = () => Math.max(element.clientWidth, element.clientHeight, 1) / 2;
  return {
    position: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    element,
    get fx() {
      return focal();
    },
    get fy() {
      return focal();
    },
    get cx() {
      return element.clientWidth / 2;
    },
    get cy() {
      return element.clientHeight / 2;
    },
  };
}

type Frustum = { l: number; r: number; t: number; b: number };

/**
 * The AR session's camera, read fresh on every access. The frustum is the one
 * the session's own hit test casts through, which matches what the renderer
 * draws with; the session keeps it private, and without it this falls back to
 * the renderer's 60-degree vertical default.
 */
export function sessionCameraView(session: ViroArSession, element: HTMLElement): CameraView {
  const frustum = (): Frustum & { w: number; h: number } => {
    const w = Math.max(element.clientWidth, 1);
    const h = Math.max(element.clientHeight, 1);
    const at = (session as unknown as { frustumAt?: (w: number, h: number) => Frustum }).frustumAt;
    if (typeof at === "function") return { w, h, ...at.call(session, w, h) };
    const t = Math.tan(Math.PI / 6);
    return { w, h, l: t * (w / h), r: t * (w / h), t, b: t };
  };
  return {
    element,
    ar: true,
    get position() {
      return session.cameraPose.position as Vec3;
    },
    get orientation() {
      return session.cameraPose.quaternion;
    },
    get fx() {
      const f = frustum();
      return f.w / (f.l + f.r);
    },
    get fy() {
      const f = frustum();
      return f.h / (f.t + f.b);
    },
    get cx() {
      const f = frustum();
      return (f.l * f.w) / (f.l + f.r);
    },
    get cy() {
      const f = frustum();
      return (f.t * f.h) / (f.t + f.b);
    },
  };
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}

/** The world ray through a pointer, for a camera that looks down -Z with +Y up. */
export function rayAt(view: CameraView, clientX: number, clientY: number): { origin: Vec3; dir: Vec3 } {
  const rect = view.element.getBoundingClientRect();
  const local: Vec3 = [(clientX - rect.left - view.cx) / view.fx, -(clientY - rect.top - view.cy) / view.fy, -1];
  const d = rotate(view.orientation, local);
  return { origin: view.position, dir: scale(d, 1 / length(d)) };
}

/** Where a world point appears in client coordinates: rayAt's inverse. Null behind the camera. */
export function screenPointOf(view: CameraView, world: Vec3): { x: number; y: number } | null {
  const [x, y, z, w] = view.orientation;
  const local = rotate([-x, -y, -z, w], sub(world, view.position));
  if (local[2] >= 0) return null;
  const rect = view.element.getBoundingClientRect();
  return {
    x: rect.left + view.cx + (view.fx * local[0]) / -local[2],
    y: rect.top + view.cy - (view.fy * local[1]) / -local[2],
  };
}

function hitPlane(ray: { origin: Vec3; dir: Vec3 }, point: Vec3, normal: Vec3): Vec3 | null {
  const denom = dot(ray.dir, normal);
  if (Math.abs(denom) < 1e-6) return null;
  const t = dot(sub(point, ray.origin), normal) / denom;
  return t > 0 ? add(ray.origin, scale(ray.dir, t)) : null;
}

/**
 * Where the ray meets the plane, kept within `max` of the ray's origin: past it,
 * the point on the circle where that sphere cuts the plane, toward the ray (as
 * virocore's getPlaneIntersect does). Null when the sphere misses the plane.
 */
function planePointWithin(ray: { origin: Vec3; dir: Vec3 }, point: Vec3, normal: Vec3, max: number): Vec3 | null {
  const to = hitPlane(ray, point, normal);
  if (to && length(sub(to, ray.origin)) <= max) return to;
  const d = dot(sub(ray.origin, point), normal);
  if (Math.abs(d) >= max) return null;
  const foot = sub(ray.origin, scale(normal, d));
  const toward = to ? sub(to, foot) : sub(ray.dir, scale(normal, dot(ray.dir, normal)));
  const len = length(toward);
  if (len < 1e-9) return null;
  return add(foot, scale(toward, Math.sqrt(max * max - d * d) / len));
}

/**
 * World to local for a node whose parent's world origin is `origin`, given that
 * parent and its ancestors nearest first, each with its Euler degrees and
 * scale. A non-uniform scale under a rotation is not exact.
 */
export function parentSpace(
  origin: readonly number[],
  ancestors: readonly { rotation?: readonly number[]; scale?: readonly number[] }[],
): (world: Vec3) => Vec3 {
  let rotation: Quat = [0, 0, 0, 1];
  const size: Vec3 = [1, 1, 1];
  for (const a of ancestors) {
    rotation = multiplyQuats(quatFromEulerDegrees(a.rotation ?? [0, 0, 0]), rotation);
    const s = a.scale ?? [1, 1, 1];
    size[0] *= s[0] || 1;
    size[1] *= s[1] || 1;
    size[2] *= s[2] || 1;
  }
  const inverse = conjugateQuat(rotation);
  const o: Vec3 = [origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0];
  return (world) => {
    const v = rotateByQuaternion(inverse, sub(world, o));
    return [v[0] / size[0], v[1] / size[1], v[2] / size[2]];
  };
}

export type DragPlane = { planePoint?: number[]; planeNormal?: number[]; maxDistance?: number };

/**
 * Where a node's origin goes while dragged, as a function of the pointer's ray.
 *
 * - FixedDistance keeps the grabbed point at its distance from the camera.
 * - FixedDistanceOrigin keeps the node's origin at its distance from the camera.
 * - FixedToPlane slides along `dragPlane`, within its maxDistance (default 10 m) of the camera.
 * - FixedToWorld slides along the horizontal plane through the grabbed point:
 *   native follows the real surfaces AR detects, which a virtual camera has none
 *   of beyond the floor.
 */
export function dragFollower(
  dragType: string,
  dragPlane: DragPlane | undefined,
  start: { ray: { origin: Vec3; dir: Vec3 }; hit: Vec3; node: Vec3 },
): ((ray: { origin: Vec3; dir: Vec3 }) => Vec3 | null) | null {
  switch (dragType) {
    case "FixedDistance": {
      const d = length(sub(start.hit, start.ray.origin));
      return (ray) => add(start.node, sub(add(ray.origin, scale(ray.dir, d)), start.hit));
    }
    case "FixedDistanceOrigin": {
      const d = length(sub(start.node, start.ray.origin));
      return (ray) => add(ray.origin, scale(ray.dir, d));
    }
    case "FixedToWorld": {
      const from = hitPlane(start.ray, start.hit, [0, 1, 0]) ?? start.hit;
      return (ray) => {
        const to = hitPlane(ray, start.hit, [0, 1, 0]);
        return to ? add(start.node, sub(to, from)) : null;
      };
    }
    case "FixedToPlane": {
      // Native leaves a node with no plane normal where it is.
      const nRaw = dragPlane?.planeNormal;
      if (!nRaw) return () => start.node;
      const nLen = Math.hypot(nRaw[0] ?? 0, nRaw[1] ?? 0, nRaw[2] ?? 0) || 1;
      const n: Vec3 = [(nRaw[0] ?? 0) / nLen, (nRaw[1] ?? 0) / nLen, (nRaw[2] ?? 0) / nLen];
      const pp = dragPlane?.planePoint ?? start.hit;
      const p: Vec3 = [pp[0] ?? 0, pp[1] ?? 0, pp[2] ?? 0];
      const max = dragPlane?.maxDistance ?? 10;
      const at = (ray: { origin: Vec3; dir: Vec3 }) => planePointWithin(ray, p, n, max);
      const from = at(start.ray) ?? start.hit;
      // As native: a node more than a centimetre off the plane is put onto it.
      const snap = Math.abs(dot(sub(start.node, p), n)) > 0.01;
      return (ray) => {
        const to = at(ray);
        if (!to) return null;
        return snap ? to : add(start.node, sub(to, from));
      };
    }
    default:
      return null;
  }
}

/** Velocity over the last ~80 ms of samples, for the throw when a dragged body is let go. */
export function releaseVelocity(samples: { t: number; p: Vec3 }[], maxSpeed = 10): Vec3 {
  const last = samples[samples.length - 1];
  if (!last) return [0, 0, 0];
  const first = samples.find((s) => last.t - s.t <= 80) ?? last;
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return [0, 0, 0];
  const v = scale(sub(last.p, first.p), 1 / dt);
  const speed = length(v);
  return speed > maxSpeed ? scale(v, maxSpeed / speed) : v;
}

export { sub, add };
