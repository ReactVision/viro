/**
 * Scene-level postProcessEffects, shared by ViroScene.web and ViroARScene.web.
 *
 * The renderer has one VROScene for every Viro scene, so the effects belong to
 * whichever scene mounted last: a scene without the prop clears its
 * predecessor's, and popping back to a scene restores its own.
 */
import { useEffect, useRef } from "react";
import type { ViroSceneApi } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./ViroWebContext";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

type Entry = { effects: string[] };
const stacks = new WeakMap<ViroSceneApi, Entry[]>();
const warnedUnknown = new Set<string>();

function apply(scene: ViroSceneApi, stack: Entry[]): void {
  const effects = stack[stack.length - 1]?.effects ?? [];
  if (typeof scene.setPostProcessEffects !== "function") {
    if (effects.length) warnUnsupported("postProcessEffects with this build of the web renderer", "the web");
    return;
  }
  const known = scene.setPostProcessEffects(effects);
  if (known < 0) {
    if (effects.length) warnUnsupported("postProcessEffects with this build of the web renderer", "the web");
    return;
  }
  if (known < effects.length) {
    const key = effects.join(",");
    if (!warnedUnknown.has(key)) {
      warnedUnknown.add(key);
      console.warn(`[Viro web] postProcessEffects: some of ${JSON.stringify(effects)} are not effect names; those are skipped.`);
    }
  }
}

export function useViroPostProcessEffects(effects: string[] | undefined): void {
  const scene = useViroScene();
  const key = JSON.stringify(effects ?? []);
  const entryRef = useRef<Entry>({ effects: [] });
  // Mount order decides which scene's effects show; prop changes keep the place.
  useEffect(() => {
    if (!scene) return;
    const entry = entryRef.current;
    let stack = stacks.get(scene);
    if (!stack) {
      stack = [];
      stacks.set(scene, stack);
    }
    stack.push(entry);
    return () => {
      const index = stack.indexOf(entry);
      if (index < 0) return;
      const wasTop = index === stack.length - 1;
      stack.splice(index, 1);
      if (wasTop) apply(scene, stack);
    };
  }, [scene]);
  useEffect(() => {
    if (!scene) return;
    const entry = entryRef.current;
    entry.effects = JSON.parse(key);
    const stack = stacks.get(scene);
    if (stack && stack[stack.length - 1] === entry) apply(scene, stack);
  }, [scene, key]);
}
