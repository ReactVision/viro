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
import { useEffect } from "react";
import type { ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroRenderer } from "./ViroWebContext";
import {
  finishViroAnimationStep,
  isRelativeDef,
  planViroAnimation,
  resolveViroAnimation,
  startViroAnimationStep,
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
): void {
  const scene = useViroScene();
  const renderer = useViroRenderer();

  const name = animation?.name;
  const run = animation?.run;
  const loop = animation?.loop;
  const delay = animation?.delay;
  const baseKey = `${base.position.join()}|${base.rotation.join()}|${base.scale.join()}|${base.opacity}`;

  useEffect(() => {
    if (!ready || !animation) return;
    const exec = name ? resolveViroAnimation(name) : null;

    if (!exec) {
      // A model's own animation, whose start and end the renderer reports.
      renderer.setNodeAnimationHandlers(node, { onStart: animation.onStart, onFinish: animation.onFinish });
      if (run !== false) {
        const animName = !name || name === "*" ? scene.getAnimationKeys(node)[0] : name;
        if (animName) scene.startAnimation(node, animName, !!loop);
      } else {
        scene.pauseAnimation(node);
      }
      return () => {
        renderer.clearNodeAnimationHandlers(node);
        scene.stopAnimation(node, false);
      };
    }
    if (run === false) return;

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
    // One animation looping to fixed values: the renderer's own loop replays it
    // from the start, which native would not, but which the web has always shown.
    const replay = !!loop && "def" in exec && !isRelativeDef(exec.def);

    const pass = (from: ViroBaseTransform) => {
      const steps: ViroAnimationStep[] = [];
      const { end, ms } = planViroAnimation(exec, from, steps);
      animation.onStart?.();
      for (const step of steps) after(step.at, () => startViroAnimationStep(scene, node, step, replay));
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
      });
    };
    after(delay ?? 0, () => pass(base));

    return () => {
      cancelAnimationFrame(frame);
      queue.length = 0;
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, run, loop, delay, baseKey]);
}
