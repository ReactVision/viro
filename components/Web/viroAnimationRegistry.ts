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

const RELATIVE = /^[-+*/]=/;

/**
 * "+=N", "-=N", "*=N" and "/=N" apply to the current value, as virocore's
 * VROPropertyAnimation does; anything else is the value itself.
 */
function resolve(value: number | string | undefined, current: number): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return current;
  const op = RELATIVE.test(value) ? value.slice(0, 2) : "";
  const n = parseFloat(op ? value.slice(2) : value);
  if (Number.isNaN(n)) return current;
  switch (op) {
    case "+=": return current + n;
    case "-=": return current - n;
    case "*=": return current * n;
    case "/=": return current / n;
    default: return n;
  }
}

function wrap360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Where `name` leaves a node that starts at `from`, or null if it is not a
 * registered animation.
 */
export function viroAnimationEnd(
  name: string,
  from: ViroBaseTransform,
): ViroBaseTransform | null {
  const p = registry.get(name)?.properties;
  if (!p) return null;
  // The renderer animates from the angle it holds, which is within one turn.
  const rotation = from.rotation.map(wrap360);
  return {
    position: [
      resolve(p.positionX, from.position[0]),
      resolve(p.positionY, from.position[1]),
      resolve(p.positionZ, from.position[2]),
    ],
    rotation: [
      resolve(p.rotateX, rotation[0]),
      resolve(p.rotateY, rotation[1]),
      resolve(p.rotateZ, rotation[2]),
    ],
    scale: [
      resolve(p.scaleX, from.scale[0]),
      resolve(p.scaleY, from.scale[1]),
      resolve(p.scaleZ, from.scale[2]),
    ],
    opacity: resolve(p.opacity, from.opacity),
  };
}

/**
 * Run a declarative animation on a node that is at `base`.
 * Returns true if `name` was a registered animation.
 *
 * `loop` replays the same pass. Native starts each pass of a relative
 * animation where the last one ended, which needs the renderer to report the
 * end of a pass; until it does, only a full turn ("+=360") loops the same.
 *
 * `delayMs` is the `animation` prop's own delay. It wins over the registered
 * one, which is how a caller that carries the delay per trigger rather than per
 * registry entry still gets it, and matches the native side, where the prop
 * delay gates the start and the registered one is a second wait on top.
 */
export function runDeclarativeAnimation(
  scene: ViroSceneApi,
  node: ViroHandle,
  name: string,
  base: ViroBaseTransform,
  loop: boolean,
  delayMs?: number,
): boolean {
  const def = registry.get(name);
  const end = viroAnimationEnd(name, base);
  if (!def || !end) return false;

  const p = def.properties;
  const delay = delayMs ?? def.delay ?? 0;
  scene.beginAnimation(node, def.duration / 1000, delay / 1000, loop, easingValue(def.easing));

  if (p.positionX !== undefined || p.positionY !== undefined || p.positionZ !== undefined) {
    scene.setNodePosition(node, ...end.position);
  }
  if (p.rotateX !== undefined || p.rotateY !== undefined || p.rotateZ !== undefined) {
    scene.setNodeRotation(
      node,
      end.rotation[0] * DEG2RAD,
      end.rotation[1] * DEG2RAD,
      end.rotation[2] * DEG2RAD,
    );
  }
  if (p.scaleX !== undefined || p.scaleY !== undefined || p.scaleZ !== undefined) {
    scene.setNodeScale(node, ...end.scale);
  }
  if (p.opacity !== undefined) {
    scene.setNodeOpacity(node, end.opacity);
  }

  scene.commitAnimation();
  return true;
}
