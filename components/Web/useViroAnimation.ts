/**
 * Drives a node's animation from the Viro `animation` prop
 * ({ name, run, loop, onStart, onFinish }). Resolves the name against two
 * systems:
 *   1. A declarative ViroAnimation (registered via ViroAnimations) → runs a
 *      transaction from the node's current transform.
 *   2. Otherwise a model animation (skeletal/keyframe) → node->getAnimation.
 *
 * `ready` gates model animations (which only exist after a model loads). If
 * `name` is omitted or "*", the model's first animation is used.
 */
import { useEffect, useRef } from "react";
import type { ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroRenderer } from "./ViroWebContext";
import {
  finishViroAnimationStep,
  forgetViroAnimationState,
  isRelativeDef,
  pauseViroAnimationPass,
  planViroAnimation,
  recordViroAnimationPass,
  resolveViroAnimation,
  resumeViroAnimationPass,
  startViroAnimationStep,
  viroAnimationCurrent,
  type ViroAnimationStep,
  type ViroBaseTransform,
} from "./viroAnimationRegistry";

export interface ViroAnimationProp {
  name?: string;
  run?: boolean;
  loop?: boolean;
  /** Milliseconds to wait before each pass, as native waits before starting. */
  delay?: number;
  onStart?: () => void;
  onFinish?: () => void;
}

export function useViroAnimation(
  node: ViroHandle,
  animation: ViroAnimationProp | undefined,
  base: ViroBaseTransform,
  ready: boolean,
  // The node's own material, for color and material animations.
  ownMaterial?: () => ViroHandle,
): void {
  const scene = useViroScene();
  const renderer = useViroRenderer();

  const name = animation?.name;
  const run = animation?.run !== false;
  const loop = animation?.loop;
  const delay = animation?.delay;
  const baseKey = `${base.position.join()}|${base.rotation.join()}|${base.scale.join()}|${base.opacity}`;
  const runRef = useRef(run);
  runRef.current = run;
  const ownMaterialRef = useRef(ownMaterial);
  ownMaterialRef.current = ownMaterial;
  // Set by the effect below while an animation is set up.
  const setRunRef = useRef<((run: boolean) => void) | null>(null);

  // Before the effect below, so a pass after an authored change starts from it.
  useEffect(() => {
    forgetViroAnimationState(node);
    return () => forgetViroAnimationState(node);
  }, [node, baseKey]);

  // `run` is not a dependency: as on native, false pauses what is playing and
  // true resumes it, where re-running this would start it over. A finished
  // animation plays again from the start the next time run turns true.
  useEffect(() => {
    if (!ready || !animation) return;
    const exec = name ? resolveViroAnimation(name) : null;
    let started = false;
    let paused = false;
    let finished = false;

    if (!exec) {
      // A model's own animation, whose start and end the renderer reports.
      renderer.setNodeAnimationHandlers(node, {
        onStart: animation.onStart,
        onFinish: () => {
          if (!loop) finished = true;
          animation.onFinish?.();
        },
      });
      let clipTimer: ReturnType<typeof setTimeout> | undefined;
      const start = () => {
        started = true;
        finished = false;
        paused = false;
        const animName = !name || name === "*" ? scene.getAnimationKeys(node)[0] : name;
        if (!animName) return;
        // The renderer takes no delay for a model's own animation.
        const startClip = () => {
          clipTimer = undefined;
          scene.startAnimation(node, animName, !!loop);
        };
        if (delay && delay > 0) clipTimer = setTimeout(startClip, delay);
        else startClip();
      };
      setRunRef.current = (on) => {
        if (on && (!started || finished)) {
          start();
        } else if (on && paused) {
          paused = false;
          scene.resumeAnimation(node);
        } else if (!on && started && !paused && !finished) {
          if (clipTimer !== undefined) {
            // Paused before its delayed start: start over when resumed.
            clearTimeout(clipTimer);
            clipTimer = undefined;
            started = false;
            return;
          }
          paused = true;
          scene.pauseAnimation(node);
        }
      };
      setRunRef.current(runRef.current);
      return () => {
        setRunRef.current = null;
        clearTimeout(clipTimer);
        renderer.clearNodeAnimationHandlers(node);
        scene.stopAnimation(node, false);
      };
    }

    // The renderer reports neither the start nor the end of a declarative
    // animation, so passes are timed here. As on native, each pass fires
    // onStart and onFinish, and a loop starts the next pass where the last
    // ended, after the prop's delay again.
    const queue: { at: number; run: () => void }[] = [];
    let frame = 0;
    const tick = () => {
      frame = 0;
      const now = performance.now();
      while (queue.length && queue[0]!.at <= now) queue.shift()!.run();
      if (queue.length && !frame) frame = requestAnimationFrame(tick);
    };
    const after = (ms: number, then: () => void) => {
      const at = performance.now() + ms;
      const i = queue.findIndex((q) => q.at > at);
      queue.splice(i < 0 ? queue.length : i, 0, { at, run: then });
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const stopTiming = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      queue.length = 0;
    };
    // One animation looping to fixed values: the renderer's own loop replays it
    // from the start, which native would not, but which the web has always shown.
    const replay = !!loop && "def" in exec && !isRelativeDef(exec.def);
    const material = () => ownMaterialRef.current?.() ?? 0;

    const pass = (from: ViroBaseTransform) => {
      const steps: ViroAnimationStep[] = [];
      const { end, ms } = planViroAnimation(exec, from, steps);
      recordViroAnimationPass(node, steps, replay);
      animation.onStart?.();
      for (const step of steps) {
        if (step.at > 0) after(step.at, () => startViroAnimationStep(scene, node, step, replay, material));
        else startViroAnimationStep(scene, node, step, replay, material);
      }
      if (replay) {
        const each = () => {
          animation.onFinish?.();
          animation.onStart?.();
          after(ms, each);
        };
        after(ms, each);
        return;
      }
      after(ms, () => {
        // The renderer may not have drawn the last steps' ends yet.
        for (const step of steps) finishViroAnimationStep(scene, node, step);
        animation.onFinish?.();
        if (loop) after(delay ?? 0, () => pass(end));
        else finished = true;
      });
    };
    const start = () => {
      started = true;
      finished = false;
      paused = false;
      // A relative value carries on from where the node is, as on native.
      const first = () => pass(viroAnimationCurrent(node, base));
      if (delay && delay > 0) after(delay, first);
      else first();
    };
    const canPause = (scene as { supportsAnimationPause?: boolean }).supportsAnimationPause === true;
    let pausedAtMs = 0;
    setRunRef.current = (on) => {
      if (on && (!started || finished)) {
        start();
      } else if (!on && started && !paused && !finished && !canPause) {
        // A renderer that cannot pause a pass draws it to its end, so its
        // timing is dropped here and run true starts a new pass, as before.
        stopTiming();
        scene.stopAnimation(node, false);
        started = false;
      } else if (on && paused) {
        paused = false;
        const shift = performance.now() - pausedAtMs;
        for (const q of queue) q.at += shift;
        resumeViroAnimationPass(node);
        scene.resumeAnimation(node);
        if (queue.length && !frame) frame = requestAnimationFrame(tick);
      } else if (!on && started && !paused && !finished) {
        paused = true;
        pausedAtMs = performance.now();
        cancelAnimationFrame(frame);
        frame = 0;
        pauseViroAnimationPass(node);
        scene.pauseAnimation(node);
      }
    };
    setRunRef.current(runRef.current);

    return () => {
      setRunRef.current = null;
      stopTiming();
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, loop, delay, baseKey]);

  useEffect(() => {
    setRunRef.current?.(run);
  }, [run]);
}
