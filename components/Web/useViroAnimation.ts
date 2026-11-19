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
  forgetViroAnimationState,
  isRelativeViroAnimation,
  pauseViroAnimationPass,
  resumeViroAnimationPass,
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
  // true resumes it, where re-running this would start it over.
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
    let clipTimer: ReturnType<typeof setTimeout> | undefined;
    // The current declarative pass's timing, shifted by any pause.
    let timing: { startsAt: number; endsAt: number; started: boolean } | null = null;
    let tick: () => void = () => {};
    // A finished animation plays again from the start the next time run turns true.
    let finished = false;
    const play = (from: ViroBaseTransform): boolean => {
      if (!name) return false;
      const pass = runDeclarativeAnimation(scene, node, name, from, !!loop && !chained, delay, () => ownMaterialRef.current?.() ?? 0);
      if (!pass) return false;
      const now = performance.now();
      const t = { startsAt: now + pass.delayMs, endsAt: now + pass.ms, started: false };
      timing = t;
      tick = () => {
        const at = performance.now();
        if (!t.started && at >= t.startsAt) {
          t.started = true;
          animation.onStart?.();
        }
        if (loop && !chained) {
          if (!t.started) frame = requestAnimationFrame(tick);
          return;
        }
        if (at < t.endsAt) {
          frame = requestAnimationFrame(tick);
          return;
        }
        // The renderer may not have drawn the pass's last step yet.
        setViroAnimationEnd(scene, node, name, pass.end);
        animation.onFinish?.();
        if (chained) play(pass.end);
        else finished = true;
      };
      frame = requestAnimationFrame(tick);
      return true;
    };

    let started = false;
    let paused = false;
    let pausedAt = 0;
    let declarative = false;
    const start = () => {
      started = true;
      finished = false;
      paused = false;
      // Try a registered declarative animation first, then a model animation.
      // A relative value carries on from where the node is, as on native.
      if (play(viroAnimationCurrent(node, base))) {
        declarative = true;
        renderer.setNodeAnimationHandlers(node, {
          onFinish: loop && !chained ? animation.onFinish : undefined,
        });
        return;
      }
      renderer.setNodeAnimationHandlers(node, {
        onStart: animation.onStart,
        onFinish: () => {
          if (!loop) finished = true;
          animation.onFinish?.();
        },
      });
      const animName = !name || name === "*" ? scene.getAnimationKeys(node)[0] : name;
      if (animName) {
        // The renderer takes no delay for a model's own animation.
        const startClip = () => {
          clipTimer = undefined;
          scene.startAnimation(node, animName, !!loop);
        };
        if (delay && delay > 0) clipTimer = setTimeout(startClip, delay);
        else startClip();
      }
    };
    const setRun = (on: boolean) => {
      if (on && (!started || finished)) {
        start();
      } else if (!on && declarative && (scene as { supportsAnimationPause?: boolean }).supportsAnimationPause !== true) {
        // A renderer that cannot pause the pass draws it to its end, so its
        // timing is dropped here and run true starts a new pass, as before.
        cancelAnimationFrame(frame);
        started = false;
      } else if (on && paused) {
        paused = false;
        scene.resumeAnimation(node);
        if (declarative) {
          resumeViroAnimationPass(node);
          const shift = performance.now() - pausedAt;
          if (timing) {
            timing.startsAt += shift;
            timing.endsAt += shift;
          }
          frame = requestAnimationFrame(tick);
        }
      } else if (!on && started && !paused && !finished) {
        if (clipTimer !== undefined) {
          // Paused before its delayed start: start over when resumed.
          clearTimeout(clipTimer);
          clipTimer = undefined;
          started = false;
          return;
        }
        paused = true;
        pausedAt = performance.now();
        scene.pauseAnimation(node);
        if (declarative) {
          pauseViroAnimationPass(node);
          cancelAnimationFrame(frame);
        }
      }
    };
    setRunRef.current = setRun;
    setRun(runRef.current);

    return () => {
      setRunRef.current = null;
      cancelAnimationFrame(frame);
      clearTimeout(clipTimer);
      renderer.clearNodeAnimationHandlers(node);
      scene.stopAnimation(node, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ready, name, loop, delay, baseKey]);

  useEffect(() => {
    setRunRef.current?.(run);
  }, [run]);
}
