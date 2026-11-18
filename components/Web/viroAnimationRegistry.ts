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

// ─── Where a node is ─────────────────────────────────────────────────────────
//
// virocore starts a relative value ("+=0.5") from the value the node holds when
// the pass begins. The renderer exposes no read of a node's local transform, so
// the steps of the latest pass on each node are kept here and the node's value
// is worked out from them: each step's end once it has finished, or the point
// its timing curve has reached if the next pass interrupts it.

interface ViroAnimationStepRecord {
  from: ViroBaseTransform;
  end: ViroBaseTransform;
  startsAt: number;
  durationMs: number;
  easing?: string;
  /** Replayed by the renderer from `from` every cycle. */
  loop: boolean;
}

const passes = new Map<ViroHandle, ViroAnimationStepRecord[]>();

/** Records the steps of a pass that starts now. */
export function recordViroAnimationPass(node: ViroHandle, steps: readonly ViroAnimationStep[], loop: boolean): void {
  const now = performance.now();
  passes.set(
    node,
    steps.map((step) => ({
      // As endOf reads it: the renderer holds an angle within one turn.
      from: { ...step.from, rotation: step.from.rotation.map(wrap360) as [number, number, number] },
      end: step.end,
      startsAt: now + step.at + (step.def.delay ?? 0),
      durationMs: step.def.duration,
      easing: step.def.easing,
      loop,
    })),
  );
}

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

function stepValue(step: ViroAnimationStepRecord, now: number): ViroBaseTransform {
  const elapsed = now - step.startsAt;
  if (step.durationMs <= 0) return step.end;
  if (!step.loop && elapsed >= step.durationMs) return step.end;
  const k = eased(step.easing, step.loop ? (elapsed % step.durationMs) / step.durationMs : elapsed / step.durationMs);
  const v = (x: number[], y: number[]) => x.map((xi, i) => lerp(xi, y[i]!, k)) as [number, number, number];
  return {
    position: v(step.from.position, step.end.position),
    rotation: v(step.from.rotation, step.end.rotation),
    scale: v(step.from.scale, step.end.scale),
    opacity: lerp(step.from.opacity, step.end.opacity, k),
  };
}

/**
 * Where `node` is now, as far as its declarative passes go: `base` until it has
 * run one, then wherever the latest one has taken it. A step that has started
 * owns the values it changes, and a later step wins, as planViroAnimation lays
 * them out.
 */
export function viroAnimationCurrent(node: ViroHandle, base: ViroBaseTransform): ViroBaseTransform {
  const steps = passes.get(node);
  if (!steps?.length) return base;
  const now = performance.now();
  let at = steps[0]!.from;
  for (const step of steps) {
    if (now <= step.startsAt) continue;
    const v = stepValue(step, now);
    const take = (cur: number[], key: "position" | "rotation" | "scale") =>
      cur.map((c, i) => (step.end[key][i] !== step.from[key][i] ? v[key][i]! : c)) as [number, number, number];
    at = {
      position: take(at.position, "position"),
      rotation: take(at.rotation, "rotation"),
      scale: take(at.scale, "scale"),
      opacity: step.end.opacity !== step.from.opacity ? v.opacity : at.opacity,
    };
  }
  return at;
}

/** Forget a node's passes: its authored transform changed, or it is gone. */
export function forgetViroAnimationState(node: ViroHandle): void {
  passes.delete(node);
}
