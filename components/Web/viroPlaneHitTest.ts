import type { ArHitResult, ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import { fromPositionEuler, rotateDirection, type Vec3 } from "../Studio/colocation/frameMath";

/**
 * A hit in native's shape (`type`, `transform`), keeping the web session's
 * fields beside it for code written against those.
 */
export type ViroPlaneHit = ArHitResult & {
  type: "ExistingPlaneUsingExtent" | "ExistingPlane";
  transform: { position: Vec3; rotation: Vec3; scale: Vec3 };
  hasDepthData: false;
};

export function toViroHit(hit: ArHitResult, plane: ArPlaneAnchor | undefined, withinExtent: boolean): ViroPlaneHit {
  return {
    ...hit,
    type: withinExtent ? "ExistingPlaneUsingExtent" : "ExistingPlane",
    transform: { position: [...hit.position], rotation: plane ? [...plane.rotation] : [0, 0, 0], scale: [1, 1, 1] },
    hasDepthData: false,
  };
}

/**
 * The planes a world ray meets inside their extent, nearest first. A plane's
 * width runs along its local X and its height along its local Z, as ARKit's
 * extent does.
 */
export function hitTestPlanes(ray: { origin: Vec3; dir: Vec3 }, planes: readonly ArPlaneAnchor[]): ViroPlaneHit[] {
  const { origin, dir } = ray;
  const hits: ViroPlaneHit[] = [];
  for (const p of planes) {
    const n = p.normal;
    const denom = dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2];
    if (Math.abs(denom) < 1e-6) continue;
    const t = ((p.center[0] - origin[0]) * n[0] + (p.center[1] - origin[1]) * n[1] + (p.center[2] - origin[2]) * n[2]) / denom;
    if (t <= 0) continue;
    const position: Vec3 = [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
    const m = fromPositionEuler([0, 0, 0], p.rotation as Vec3);
    const x = rotateDirection(m, [1, 0, 0]);
    const z = rotateDirection(m, [0, 0, 1]);
    const d: Vec3 = [position[0] - p.center[0], position[1] - p.center[1], position[2] - p.center[2]];
    const along = (a: Vec3) => d[0] * a[0] + d[1] * a[1] + d[2] * a[2];
    if (Math.abs(along(x)) > p.width / 2 || Math.abs(along(z)) > p.height / 2) continue;
    hits.push(toViroHit({ anchorId: p.id, position, normal: [...n], distance: t }, p, true));
  }
  return hits.sort((a, b) => a.distance - b.distance);
}
