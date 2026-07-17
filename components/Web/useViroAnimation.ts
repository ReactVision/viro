/**
 * Drives a node's model animation from the Viro `animation` prop
 * ({ name, run, loop, onStart, onFinish }). Skeletal/keyframe animations only
 * exist after a model has loaded, so `ready` gates the start.
 *
 * If `name` is omitted or "*", the model's first animation is used (handy when
 * the animation names aren't known ahead of time).
 */
import { useEffect } from "react";
import type { ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroRenderer } from "./ViroWebContext";

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
  ready: boolean,
): void {
  const scene = useViroScene();
  const renderer = useViroRenderer();

  const name = animation?.name;
  const run = animation?.run;
  const loop = animation?.loop;

  useEffect(() => {
    if (!ready || !animation) return;

    renderer.setNodeAnimationHandlers(node, {
      onStart: animation.onStart,
      onFinish: animation.onFinish,
    });

    if (run !== false) {
      let animName = name;
      if (!animName || animName === "*") {
        animName = scene.getAnimationKeys(node)[0];
      }
      if (animName) {
        scene.startAnimation(node, animName, !!loop);
      }
    } else {
      scene.pauseAnimation(node);
    }

    return () => {
      renderer.clearNodeAnimationHandlers(node);
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, run, loop]);
}
