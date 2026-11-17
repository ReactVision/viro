/**
 * Which ViroCamera, if any, a scene has made its point of view, so a camera the
 * host drives (the preview's virtual camera) can stand aside while it is.
 */
import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";

const active = new WeakMap<ViroSceneApi, Set<ViroHandle>>();
const listeners = new WeakMap<ViroSceneApi, Set<() => void>>();

export function setSceneCameraActive(scene: ViroSceneApi, node: ViroHandle, on: boolean): void {
  let nodes = active.get(scene);
  if (!nodes) active.set(scene, (nodes = new Set()));
  if (on === nodes.has(node)) return;
  if (on) nodes.add(node);
  else nodes.delete(node);
  listeners.get(scene)?.forEach((l) => l());
}

export function sceneCameraActive(scene: ViroSceneApi): boolean {
  return (active.get(scene)?.size ?? 0) > 0;
}

export function onSceneCameraChange(scene: ViroSceneApi, listener: () => void): () => void {
  let set = listeners.get(scene);
  if (!set) listeners.set(scene, (set = new Set()));
  set.add(listener);
  return () => void set!.delete(listener);
}
