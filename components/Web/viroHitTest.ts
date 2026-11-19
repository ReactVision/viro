/**
 * AR hit tests in native's result shape (ViroARHitTestResult). The web tracker
 * reports planes only, so every hit is on one: "ExistingPlaneUsingExtent" inside
 * the plane's detected rectangle, "ExistingPlane" on its extension beyond it.
 */
import type { ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import type { ViroARHitTestResult } from "../Types/ViroEvents";
import { conjugateQuat, quatFromEulerDegrees, rotateByQuaternion, type Vec3 } from "./viroMath";

export function planeHitResult(plane: ArPlaneAnchor, position: Vec3): ViroARHitTestResult {
  const local = rotateByQuaternion(conjugateQuat(quatFromEulerDegrees(plane.rotation)), [
    position[0] - plane.center[0],
    position[1] - plane.center[1],
    position[2] - plane.center[2],
  ]);
  const inside = Math.abs(local[0]) <= plane.width / 2 && Math.abs(local[2]) <= plane.height / 2;
  return {
    type: inside ? "ExistingPlaneUsingExtent" : "ExistingPlane",
    transform: { position: [...position] as Vec3, rotation: [...plane.rotation] as Vec3, scale: [1, 1, 1] },
    hasDepthData: false,
  };
}

/** Where a ray meets the planes, nearest first, within `maxDistance` along it. */
export function hitTestPlanes(
  planes: readonly ArPlaneAnchor[],
  origin: Vec3,
  direction: Vec3,
  maxDistance = Infinity,
): ViroARHitTestResult[] {
  const len = Math.hypot(...direction);
  if (len === 0) return [];
  const dir: Vec3 = [direction[0] / len, direction[1] / len, direction[2] / len];
  const hits: { t: number; result: ViroARHitTestResult }[] = [];
  for (const p of planes) {
    const denom = dir[0] * p.normal[0] + dir[1] * p.normal[1] + dir[2] * p.normal[2];
    if (Math.abs(denom) < 1e-6) continue;
    const t =
      ((p.center[0] - origin[0]) * p.normal[0] +
        (p.center[1] - origin[1]) * p.normal[1] +
        (p.center[2] - origin[2]) * p.normal[2]) /
      denom;
    if (t <= 0 || t > maxDistance) continue;
    const at: Vec3 = [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
    hits.push({ t, result: planeHitResult(p, at) });
  }
  return hits.sort((a, b) => a.t - b.t).map((h) => h.result);
}
