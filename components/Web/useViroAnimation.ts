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
  isRelativeViroAnimation,
  runDeclarativeAnimation,
  setViroAnimationEnd,
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

  useEffect(() => {
    if (!ready || !animation) return;

    // A looping relative animation ("+=90") starts each pass where the last one
    // ended, as on native. The renderer's loop replays the first pass, and it
    // does not report the end of a pass that is not looping, so the passes are
    // timed here.
    const chained = !!loop && !!name && isRelativeViroAnimation(name);
    let frame = 0;
    const play = (from: ViroBaseTransform): boolean => {
      if (!name) return false;
      const pass = runDeclarativeAnimation(scene, node, name, from, !!loop && !chained, delay);
      if (!pass) return false;
      if (chained) {
        const endsAt = performance.now() + pass.ms;
        const tick = () => {
          if (performance.now() < endsAt) {
            frame = requestAnimationFrame(tick);
            return;
          }
          // The renderer may not have drawn the pass's last step yet.
          setViroAnimationEnd(scene, node, name, pass.end);
          animation.onFinish?.();
          play(pass.end);
        };
        frame = requestAnimationFrame(tick);
      }
      return true;
    };

    renderer.setNodeAnimationHandlers(node, {
      onStart: animation.onStart,
      onFinish: chained ? undefined : animation.onFinish,
    });

    if (run !== false) {
      // Try a registered declarative animation first, then a model animation.
      if (!play(base)) {
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
