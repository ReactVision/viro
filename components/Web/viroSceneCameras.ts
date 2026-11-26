/**
 * The scene's camera components, as native's ViroActiveCameraTracker keeps
 * them: the last one activated is the point of view, and releasing it goes
 * back to the default camera, never to an earlier one. A camera the host
 * drives (the preview's virtual camera) listens, standing aside while one
 * draws and taking the view back when it is released.
 */
import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";

type SceneCameras = { active: ViroHandle | null; orthographic: Set<ViroHandle>; fieldOfView: Map<ViroHandle, number>; fallback: ViroHandle };
const sceneCameras = new WeakMap<ViroSceneApi, SceneCameras>();
const listeners = new WeakMap<ViroSceneApi, Set<() => void>>();

function camerasOf(scene: ViroSceneApi): SceneCameras {
  let cams = sceneCameras.get(scene);
  if (!cams) sceneCameras.set(scene, (cams = { active: null, orthographic: new Set(), fieldOfView: new Map(), fallback: 0 }));
  return cams;
}

function notify(scene: ViroSceneApi): void {
  listeners.get(scene)?.forEach((l) => l());
}

/** The camera component that draws, or null for the default camera. */
export function activeSceneCamera(scene: ViroSceneApi): ViroHandle | null {
  return sceneCameras.get(scene)?.active ?? null;
}

export function sceneCameraActive(scene: ViroSceneApi): boolean {
  return activeSceneCamera(scene) !== null;
}

export function sceneCameraOrthographic(scene: ViroSceneApi, node: ViroHandle): boolean {
  return !!sceneCameras.get(scene)?.orthographic.has(node);
}

/** Degrees across the longer side of the view, or 0 for the renderer's default. */
export function sceneCameraFieldOfView(scene: ViroSceneApi, node: ViroHandle): number {
  return sceneCameras.get(scene)?.fieldOfView.get(node) ?? 0;
}

export function setSceneCameraFieldOfView(scene: ViroSceneApi, node: ViroHandle, degrees: number): void {
  const map = camerasOf(scene).fieldOfView;
  if (degrees > 0) map.set(node, degrees);
  else map.delete(node);
}

/**
 * Makes a camera component's node the point of view until the returned
 * release, which returns to the default camera if this one still draws.
 */
export function activateSceneCamera(scene: ViroSceneApi, node: ViroHandle): () => void {
  const cams = camerasOf(scene);
  cams.active = node;
  scene.setActiveCameraNode(node);
  notify(scene);
  return () => {
    if (cams.active !== node) return;
    cams.active = null;
    if (cams.fallback) scene.setActiveCameraNode(cams.fallback);
    notify(scene);
  };
}

export function setSceneCameraOrthographic(scene: ViroSceneApi, node: ViroHandle, orthographic: boolean): void {
  const set = camerasOf(scene).orthographic;
  if (orthographic) set.add(node);
  else set.delete(node);
}

/**
 * A camera at the origin looking down -Z under `root`, which is virocore's
 * default and what a released camera component returns to: the renderer's own
 * default camera has no handle to return to.
 */
export function installDefaultCamera(scene: ViroSceneApi, root: ViroHandle): () => void {
  const node = scene.createNode();
  scene.setNodeCamera(node);
  scene.addChildNode(root, node);
  const cams = camerasOf(scene);
  cams.fallback = node;
  return () => {
    if (cams.fallback === node) cams.fallback = 0;
    scene.removeNodeFromParent(node);
    scene.destroyNode(node);
  };
}

export function onSceneCameraChange(scene: ViroSceneApi, listener: () => void): () => void {
  let set = listeners.get(scene);
  if (!set) listeners.set(scene, (set = new Set()));
  set.add(listener);
  return () => void set!.delete(listener);
}
