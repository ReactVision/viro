/**
 * Web registry for declarative ViroAnimations (transform/opacity keyframes).
 * ViroAnimations.web.registerAnimations() stores definitions here; the bridge
 * resolves an `animation` name against this registry and, if found, runs a
 * transaction (begin → set target props → commit) for each animation in it so
 * the renderer interpolates. Chains run as native parses them
 * (VRTAnimationManager): a registered array runs its members in parallel, any
 * array inside one or behind a name runs them in sequence.
 *
 * Scope: position/scale/rotation (per-axis) + opacity. color/material/translate
 * are follow-ups.
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

/** An animation, the name of a registered one, or an array of these. */
export type ViroWebAnimationEntry = ViroWebAnimationDef | string | ViroWebAnimationEntry[];

const registry = new Map<string, ViroWebAnimationEntry>();

export function registerViroAnimations(
  animations: Record<string, ViroWebAnimationEntry>,
): void {
  for (const name of Object.keys(animations)) {
    registry.set(name, animations[name]);
  }
}

const isDef = (entry: unknown): entry is ViroWebAnimationDef =>
  !!entry && typeof entry === "object" && !Array.isArray(entry) && "properties" in entry;

export function getViroAnimationDef(name: string): ViroWebAnimationDef | undefined {
  const entry = registry.get(name);
  return isDef(entry) ? entry : undefined;
}

/** A registered animation as it runs: one animation, or a chain of them in sequence or in parallel. */
export type ViroAnimationExec = { def: ViroWebAnimationDef } | { serial: boolean; items: ViroAnimationExec[] };

function parseEntry(entry: unknown, serial: boolean, names: ReadonlySet<string>): ViroAnimationExec | null {
  if (typeof entry === "string") {
    // A name that leads back to itself would never end.
    if (names.has(entry)) return null;
    return parseEntry(registry.get(entry), true, new Set([...names, entry]));
  }
  if (Array.isArray(entry)) {
    const items = entry.map((e) => parseEntry(e, true, names)).filter((e): e is ViroAnimationExec => !!e);
    return items.length ? { serial, items } : null;
  }
  return isDef(entry) ? { def: entry } : null;
}

/** `name` as it runs, or null when it is not a registered animation. */
export function resolveViroAnimation(name: string): ViroAnimationExec | null {
  return parseEntry(registry.get(name), false, new Set([name]));
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
  const def = getViroAnimationDef(name);
  return def ? endOf(def, from) : null;
}

function endOf(def: ViroWebAnimationDef, from: ViroBaseTransform): ViroBaseTransform {
  const p = def.properties;
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
  const def = getViroAnimationDef(name);
  return !!def && isRelativeDef(def);
}

export function isRelativeDef(def: ViroWebAnimationDef): boolean {
  return Object.values(def.properties).some((v) => typeof v === "string" && RELATIVE.test(v));
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

/** One animation of a pass: when it starts (ms into the pass), and where it takes the node from and to. */
export interface ViroAnimationStep {
  at: number;
  def: ViroWebAnimationDef;
  from: ViroBaseTransform;
  end: ViroBaseTransform;
}

const pick = (a: number[], b: number[], base: number[]) => a.map((v, i) => (b[i] !== base[i] ? b[i]! : v));

/**
 * Lays out one pass of `exec` from `from`, starting `at` ms in: pushes each
 * animation's step onto `steps` and returns where the pass leaves the node and
 * how long it takes. Members of a parallel chain each take the properties they
 * change; one that changes the same property as another wins by order.
 */
export function planViroAnimation(
  exec: ViroAnimationExec,
  from: ViroBaseTransform,
  steps: ViroAnimationStep[],
  at = 0,
): { end: ViroBaseTransform; ms: number } {
  if ("def" in exec) {
    const end = endOf(exec.def, from);
    steps.push({ at, def: exec.def, from, end });
    return { end, ms: (exec.def.delay ?? 0) + exec.def.duration };
  }
  if (exec.serial) {
    let end = from;
    let ms = 0;
    for (const item of exec.items) {
      const r = planViroAnimation(item, end, steps, at + ms);
      end = r.end;
      ms += r.ms;
    }
    return { end, ms };
  }
  let end = from;
  let ms = 0;
  for (const item of exec.items) {
    const r = planViroAnimation(item, from, steps, at);
    end = {
      position: pick(end.position, r.end.position, from.position) as ViroBaseTransform["position"],
      rotation: pick(end.rotation, r.end.rotation, from.rotation) as ViroBaseTransform["rotation"],
      scale: pick(end.scale, r.end.scale, from.scale) as ViroBaseTransform["scale"],
      opacity: r.end.opacity !== from.opacity ? r.end.opacity : end.opacity,
    };
    ms = Math.max(ms, r.ms);
  }
  return { end, ms };
}

/**
 * Starts a step. The node is put at the step's start first: the renderer may
 * not have drawn the last step's end yet. `loop` is the renderer's own, which
 * replays the step from where it started.
 */
export function startViroAnimationStep(scene: ViroSceneApi, node: ViroHandle, step: ViroAnimationStep, loop = false): void {
  setAnimated(scene, node, step.def.properties, step.from);
  scene.beginAnimation(node, step.def.duration / 1000, (step.def.delay ?? 0) / 1000, loop, easingValue(step.def.easing));
  setAnimated(scene, node, step.def.properties, step.end);
  scene.commitAnimation();
}

/** Puts the node at a step's end now. */
export function finishViroAnimationStep(scene: ViroSceneApi, node: ViroHandle, step: ViroAnimationStep): void {
  setAnimated(scene, node, step.def.properties, step.end);
}
