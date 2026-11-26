/**
 * Records what the developer does in a previewed scene and plays it back: the
 * camera, sampled as poses, and the pointer input that reached the scene,
 * stored as fractions of the canvas so a replay lands on the same spots at
 * another size. It repeats input, not app state: animations, physics and
 * timers can run differently on a replay.
 *
 * Timers, not requestAnimationFrame, which a host can hold back in a nested
 * cross-origin frame.
 */
type Vec3 = [number, number, number];
type Pose = { position: Vec3; target: Vec3 };
type PointerType = "pointerdown" | "pointermove" | "pointerup" | "pointercancel";

export type RecordedPose = Pose & { t: number };
export type RecordedInput = {
  t: number;
  type: PointerType;
  x: number;
  y: number;
  button: number;
  buttons: number;
  pointerType: string;
  pointerId: number;
};
export type SessionTrack = { poses: RecordedPose[]; inputs: RecordedInput[]; duration: number };

const SAMPLE_MS = 33;
const POINTER_TYPES: PointerType[] = ["pointerdown", "pointermove", "pointerup", "pointercancel"];

const samePose = (a: Pose, b: Pose) => a.position.every((v, i) => v === b.position[i]) && a.target.every((v, i) => v === b.target[i]);

/**
 * Starts recording `canvas` and the camera `pose` reads. Only events that
 * reach the canvas are kept: the virtual camera stops its own gestures before
 * they get there.
 */
export function recordSession(canvas: HTMLElement, pose: () => Pose): { stop(): SessionTrack } {
  const start = performance.now();
  const poses: RecordedPose[] = [];
  const inputs: RecordedInput[] = [];
  const sample = () => {
    const p = pose();
    const last = poses[poses.length - 1];
    if (!last || !samePose(last, p)) poses.push({ t: performance.now() - start, position: [...p.position], target: [...p.target] });
  };
  sample();
  const timer = setInterval(sample, SAMPLE_MS);
  const onPointer = (e: PointerEvent) => {
    // The camera's own pointercancel ends a finger that turned into a two-finger gesture.
    if (!e.isTrusted && e.type !== "pointercancel") return;
    const rect = canvas.getBoundingClientRect();
    inputs.push({
      t: performance.now() - start,
      type: e.type as PointerType,
      x: (e.clientX - rect.left) / Math.max(rect.width, 1),
      y: (e.clientY - rect.top) / Math.max(rect.height, 1),
      button: e.button,
      buttons: e.buttons,
      pointerType: e.pointerType,
      pointerId: e.pointerId,
    });
  };
  for (const type of POINTER_TYPES) canvas.addEventListener(type, onPointer);
  return {
    stop() {
      clearInterval(timer);
      for (const type of POINTER_TYPES) canvas.removeEventListener(type, onPointer);
      sample();
      return { poses, inputs, duration: performance.now() - start };
    },
  };
}

const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/** Plays `track` on `canvas` from now. `onProgress` gets the elapsed milliseconds; returns a stop function. */
export function playSession(
  track: SessionTrack,
  canvas: HTMLElement,
  lookFrom: (position: Vec3, target: Vec3) => void,
  onProgress: (elapsed: number) => void,
  onDone: () => void,
): () => void {
  const start = performance.now();
  let pose = 0;
  let input = 0;
  const tick = () => {
    const t = performance.now() - start;
    const { poses, inputs } = track;
    while (pose + 1 < poses.length && poses[pose + 1]!.t <= t) pose++;
    const a = poses[pose];
    const b = poses[pose + 1];
    if (a) {
      const f = b ? Math.min(1, Math.max(0, (t - a.t) / Math.max(b.t - a.t, 1))) : 0;
      lookFrom(b ? lerp(a.position, b.position, f) : a.position, b ? lerp(a.target, b.target, f) : a.target);
    }
    const rect = canvas.getBoundingClientRect();
    while (input < inputs.length && inputs[input]!.t <= t) {
      const e = inputs[input++]!;
      canvas.dispatchEvent(
        new PointerEvent(e.type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: rect.left + e.x * rect.width,
          clientY: rect.top + e.y * rect.height,
          button: e.button,
          buttons: e.buttons,
          pointerType: e.pointerType,
          pointerId: e.pointerId,
          isPrimary: true,
        }),
      );
    }
    onProgress(Math.min(t, track.duration));
    if (t >= track.duration) {
      clearInterval(timer);
      onDone();
    }
  };
  const timer = setInterval(tick, 16);
  tick();
  return () => clearInterval(timer);
}
