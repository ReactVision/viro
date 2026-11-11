/**
 * Dragging nodes on the web (`dragType`, `onDrag`).
 *
 * The renderer reports where a press hit a node but has no drag events and no
 * way to read the camera back, so whatever drives the camera publishes its view
 * here (the virtual camera does; the live phone session does not yet, and there
 * dragging stays unsupported), and a drag turns pointer positions into world
 * rays itself.
 */
import type { ViroSceneApi } from "@reactvision/viro-web-renderer";

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
};

const views = new WeakMap<ViroSceneApi, CameraView>();

export function setCameraView(scene: ViroSceneApi, view: CameraView | null): void {
  if (view) views.set(scene, view);
  else views.delete(scene);
}

export function cameraView(scene: ViroSceneApi): CameraView | null {
  return views.get(scene) ?? null;
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
