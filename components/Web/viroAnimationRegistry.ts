/**
 * Web registry for declarative ViroAnimations (transform/opacity keyframes).
 * ViroAnimations.web.createAnimations() stores definitions here; the bridge
 * resolves an `animation` name against this registry and, if found, runs a
 * transaction (begin → set target props → commit) so the renderer interpolates.
 *
 * MVP scope: position/scale/rotation (per-axis) + opacity. color/material/
 * translate/animation-chains are follow-ups.
 */
import type { ViroSceneApi, ViroHandle } from "@reactvision/viro-web-renderer";
import { ViroEasing } from "@reactvision/viro-web-renderer";

const DEG2RAD = Math.PI / 180;

export interface ViroWebAnimationDef {
  duration: number; // ms
  delay?: number; // ms
  easing?: string;
  properties: Record<string, number | string | undefined>;
}

const registry = new Map<string, ViroWebAnimationDef>();

export function registerViroAnimations(
  animations: Record<string, ViroWebAnimationDef>,
): void {
  for (const name of Object.keys(animations)) {
    registry.set(name, animations[name]);
  }
}

export function getViroAnimationDef(name: string): ViroWebAnimationDef | undefined {
  return registry.get(name);
}

export interface ViroBaseTransform {
  position: [number, number, number];
  rotation: [number, number, number]; // degrees
  scale: [number, number, number];
  opacity: number;
}

function easingValue(easing?: string): ViroEasing {
  switch (easing) {
    case "EaseIn": return ViroEasing.EaseIn;
    case "EaseOut": return ViroEasing.EaseOut;
    case "EaseInEaseOut": return ViroEasing.EaseInEaseOut;
    case "Bounce": return ViroEasing.Bounce;
    case "PowerDecel": return ViroEasing.PowerDecel;
    default: return ViroEasing.Linear;
  }
}

function coerce(value: number | string | undefined, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Run a declarative animation on a node, starting from its current transform.
 * Returns true if `name` was a registered animation.
 */
export function runDeclarativeAnimation(
  scene: ViroSceneApi,
  node: ViroHandle,
  name: string,
  base: ViroBaseTransform,
  loop: boolean,
): boolean {
  const def = registry.get(name);
  if (!def) return false;

  const p = def.properties;
  scene.beginAnimation(node, def.duration / 1000, (def.delay ?? 0) / 1000, loop, easingValue(def.easing));

  if (p.positionX !== undefined || p.positionY !== undefined || p.positionZ !== undefined) {
    scene.setNodePosition(
      node,
      coerce(p.positionX, base.position[0]),
      coerce(p.positionY, base.position[1]),
      coerce(p.positionZ, base.position[2]),
    );
  }
  if (p.rotateX !== undefined || p.rotateY !== undefined || p.rotateZ !== undefined) {
    scene.setNodeRotation(
      node,
      coerce(p.rotateX, base.rotation[0]) * DEG2RAD,
      coerce(p.rotateY, base.rotation[1]) * DEG2RAD,
      coerce(p.rotateZ, base.rotation[2]) * DEG2RAD,
    );
  }
  if (p.scaleX !== undefined || p.scaleY !== undefined || p.scaleZ !== undefined) {
    scene.setNodeScale(
      node,
      coerce(p.scaleX, base.scale[0]),
      coerce(p.scaleY, base.scale[1]),
      coerce(p.scaleZ, base.scale[2]),
    );
  }
  if (p.opacity !== undefined) {
    scene.setNodeOpacity(node, coerce(p.opacity, base.opacity));
  }

  scene.commitAnimation();
  return true;
}
