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
import { runDeclarativeAnimation, type ViroBaseTransform } from "./viroAnimationRegistry";

export interface ViroAnimationProp {
  name?: string;
  run?: boolean;
  loop?: boolean;
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
  const baseKey = `${base.position.join()}|${base.rotation.join()}|${base.scale.join()}|${base.opacity}`;

  useEffect(() => {
    if (!ready || !animation) return;

    renderer.setNodeAnimationHandlers(node, {
      onStart: animation.onStart,
      onFinish: animation.onFinish,
    });

    if (run !== false) {
      // Try a registered declarative animation first, then a model animation.
      if (!name || !runDeclarativeAnimation(scene, node, name, base, !!loop)) {
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
      renderer.clearNodeAnimationHandlers(node);
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, run, loop, baseKey]);
}
