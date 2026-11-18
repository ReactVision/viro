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

/** True when `name` moves the node from wherever it is, so a repeat carries on from the last one. */
export function isRelativeViroAnimation(name: string): boolean {
  const p = registry.get(name)?.properties;
  return !!p && Object.values(p).some((v) => typeof v === "string" && RELATIVE.test(v));
}

function setAnimated(
  scene: ViroSceneApi,
  node: ViroHandle,
  p: ViroWebAnimationDef["properties"],
  end: ViroBaseTransform,
): void {
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
}

/** Put a node at `end` now, for the properties `name` animates. */
export function setViroAnimationEnd(
  scene: ViroSceneApi,
  node: ViroHandle,
  name: string,
  end: ViroBaseTransform,
): void {
  const p = registry.get(name)?.properties;
  if (p) setAnimated(scene, node, p, end);
}

export interface ViroAnimationPass {
  /** Where the pass leaves the node. */
  end: ViroBaseTransform;
  /** Delay plus duration. */
  ms: number;
  /** The delay alone: when the pass starts moving. */
  delayMs: number;
}

/**
 * Run a declarative animation on a node that is at `base`, and record it as the
 * node's latest pass.
 * Returns null if `name` is not a registered animation.
 *
 * `loop` is the renderer's own, which replays the same pass.
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
): ViroAnimationPass | null {
  const def = registry.get(name);
  const end = viroAnimationEnd(name, base);
  if (!def || !end) return null;

  const delay = delayMs ?? def.delay ?? 0;
  scene.beginAnimation(node, def.duration / 1000, delay / 1000, loop, easingValue(def.easing));
  setAnimated(scene, node, def.properties, end);
  scene.commitAnimation();
  passes.set(node, {
    // As viroAnimationEnd reads it: the renderer holds an angle within one turn.
    from: { ...base, rotation: base.rotation.map(wrap360) as [number, number, number] },
    end,
    startsAt: performance.now() + delay,
    durationMs: def.duration,
    easing: def.easing,
    loop,
  });
  return { end, ms: delay + def.duration, delayMs: delay };
}

// ─── Where a node is ─────────────────────────────────────────────────────────
//
// virocore starts a relative value ("+=0.5") from the value the node holds when
// the pass begins. The renderer exposes no read of a node's local transform, so
// the latest pass on each node is kept here and the node's value is worked out
// from it: its end once it has finished, or the point the timing curve has
// reached if the next pass interrupts it.

interface ViroAnimationPassRecord {
  from: ViroBaseTransform;
  end: ViroBaseTransform;
  startsAt: number;
  durationMs: number;
  easing?: string;
  /** Replayed by the renderer from `from` every cycle. */
  loop: boolean;
}

const passes = new Map<ViroHandle, ViroAnimationPassRecord>();

/** virocore's VROTimingFunction curves, which the renderer animates with. */
function eased(easing: string | undefined, t: number): number {
  switch (easing) {
    case "EaseIn":
      return t <= 0.5 ? 2 * t * t : t;
    case "EaseOut":
      return t <= 0.5 ? t : 2 * (t - 0.5) * (1 - (t - 0.5)) + 0.5;
    case "EaseInEaseOut":
      return t <= 0.5 ? 2 * t * t : 2 * (t - 0.5) * (1 - (t - 0.5)) + 0.5;
    case "Bounce":
      if (t < 0.5) return t / 0.45;
      if (t < 0.67) return 0.5 / 0.45 - (t - 0.5) / 0.85;
      return 0.5 / 0.45 - (0.67 - 0.5) / 0.85 + (t - 0.67) / 3.3;
    case "PowerDecel":
      return 1 - (1 - t) ** 2;
    default:
      return t;
  }
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function lerpTransform(a: ViroBaseTransform, b: ViroBaseTransform, k: number): ViroBaseTransform {
  const v = (x: number[], y: number[]) =>
    x.map((xi, i) => lerp(xi, y[i]!, k)) as [number, number, number];
  return {
    position: v(a.position, b.position),
    rotation: v(a.rotation, b.rotation),
    scale: v(a.scale, b.scale),
    opacity: lerp(a.opacity, b.opacity, k),
  };
}

/**
 * Where `node` is now, as far as its declarative passes go: `base` until it has
 * run one, then wherever the latest one has taken it.
 */
export function viroAnimationCurrent(node: ViroHandle, base: ViroBaseTransform): ViroBaseTransform {
  const pass = passes.get(node);
  if (!pass) return base;
  const elapsed = performance.now() - pass.startsAt;
  if (elapsed <= 0) return pass.from;
  if (pass.durationMs <= 0) return pass.end;
  if (!pass.loop && elapsed >= pass.durationMs) return pass.end;
  const t = pass.loop ? (elapsed % pass.durationMs) / pass.durationMs : elapsed / pass.durationMs;
  return lerpTransform(pass.from, pass.end, eased(pass.easing, t));
}

/** Forget a node's passes: its authored transform changed, or it is gone. */
export function forgetViroAnimationState(node: ViroHandle): void {
  passes.delete(node);
}
