import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";

// Inside a ViroPortalScene a 360 image, 360 video or skybox is that portal's
// background, as on native; anywhere else it is the scene's. `node` is the
// component's parent, from which the wasm finds the portal. A renderer without
// the per-node setters (1.2.0) sets the scene's either way.
//
// The per-node calls wait a microtask: a parent node joins its portal in its own
// mount effect, which React runs after the child's, so a call straight from the
// child's effect would find no portal above a ViroNode and fall to the scene's.

const perNode = (node: ViroHandle, call: () => boolean | undefined, fallback: () => void) => {
  if (!node) return fallback();
  queueMicrotask(() => {
    if (!call()) fallback();
  });
};

export function setViroBackgroundSphere(scene: ViroSceneApi, node: ViroHandle, texture: ViroHandle): void {
  if (typeof scene.setNodeBackgroundSphere !== "function") return scene.setBackgroundSphere(texture);
  perNode(node, () => scene.setNodeBackgroundSphere(node, texture), () => scene.setBackgroundSphere(texture));
}

export function setViroBackgroundCube(scene: ViroSceneApi, node: ViroHandle, texture: ViroHandle): void {
  if (typeof scene.setNodeBackgroundCube !== "function") return scene.setBackgroundCube(texture);
  perNode(node, () => scene.setNodeBackgroundCube(node, texture), () => scene.setBackgroundCube(texture));
}

/** Native's 360 image takes its background with it when it goes. */
export function removeViroBackground(scene: ViroSceneApi, node: ViroHandle): void {
  if (node && typeof scene.removeNodeBackground === "function") scene.removeNodeBackground(node);
}

/** `rotation` in degrees, as the components take it. */
export function setViroBackgroundRotation(
  scene: ViroSceneApi,
  node: ViroHandle,
  rotation: [number, number, number],
): void {
  const [x, y, z] = rotation.map((d) => (d * Math.PI) / 180);
  if (typeof scene.setNodeBackgroundRotation !== "function") return scene.setBackgroundRotation(x, y, z);
  perNode(node, () => scene.setNodeBackgroundRotation(node, x, y, z), () => scene.setBackgroundRotation(x, y, z));
}
