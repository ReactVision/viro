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
  forgetViroAnimationState,
  isRelativeViroAnimation,
  runDeclarativeAnimation,
  setViroAnimationEnd,
  viroAnimationCurrent,
  type ViroBaseTransform,
} from "./viroAnimationRegistry";

export interface ViroAnimationProp {
  name?: string;
  run?: boolean;
  loop?: boolean;
  /** Milliseconds to wait before the first value, per trigger. */
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

  // Before the effect below, so a pass after an authored change starts from it.
  useEffect(() => {
    forgetViroAnimationState(node);
    return () => forgetViroAnimationState(node);
  }, [node, baseKey]);

  useEffect(() => {
    if (!ready || !animation) return;

    // The renderer reports neither the start of a declarative pass nor the end
    // of one that is not looping: its transaction callback cannot tell an end
    // from a stop. Both are timed here. A looping relative animation ("+=90")
    // starts each pass where the last one ended, as on native, so its passes
    // are chained here too; a looping absolute one is replayed by the renderer,
    // which does report each cycle's end.
    const chained = !!loop && !!name && isRelativeViroAnimation(name);
    let frame = 0;
    const play = (from: ViroBaseTransform): boolean => {
      if (!name) return false;
      const pass = runDeclarativeAnimation(scene, node, name, from, !!loop && !chained, delay);
      if (!pass) return false;
      const now = performance.now();
      const startsAt = now + pass.delayMs;
      const endsAt = now + pass.ms;
      let started = false;
      const tick = () => {
        const t = performance.now();
        if (!started && t >= startsAt) {
          started = true;
          animation.onStart?.();
        }
        if (loop && !chained) {
          if (!started) frame = requestAnimationFrame(tick);
          return;
        }
        if (t < endsAt) {
          frame = requestAnimationFrame(tick);
          return;
        }
        // The renderer may not have drawn the pass's last step yet.
        setViroAnimationEnd(scene, node, name, pass.end);
        animation.onFinish?.();
        if (chained) play(pass.end);
      };
      frame = requestAnimationFrame(tick);
      return true;
    };

    if (run !== false) {
      // Try a registered declarative animation first, then a model animation.
      // A relative value carries on from where the node is, as on native.
      if (play(viroAnimationCurrent(node, base))) {
        renderer.setNodeAnimationHandlers(node, {
          onFinish: loop && !chained ? animation.onFinish : undefined,
        });
      } else {
        renderer.setNodeAnimationHandlers(node, {
          onStart: animation.onStart,
          onFinish: animation.onFinish,
        });
        let animName = name;
        if (!animName || animName === "*") {
          animName = scene.getAnimationKeys(node)[0];
        }
        if (animName) {
          scene.startAnimation(node, animName, !!loop);
        }
      }
    } else {
      scene.pauseAnimation(node);
    }

    return () => {
      cancelAnimationFrame(frame);
      renderer.clearNodeAnimationHandlers(node);
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, run, loop, delay, baseKey]);
}
