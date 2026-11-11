/**
 * Routes the renderer's one scene-level collision callback to the bodies and
 * listeners that asked for collisions.
 *
 * The renderer reports each collision once per body, as that body's tag and the
 * other body's tag. Native delivers it to the node itself instead, so two nodes
 * sharing a viroTag (or both having none) still hear only their own. Hence every
 * body gets a unique key as its renderer tag, and callers only ever see viroTags.
 */
import type { ViroCollision, ViroSceneApi } from "@reactvision/viro-web-renderer";

type Vec3 = [number, number, number];
type BodyCollisionHandler = (otherViroTag: string, point: Vec3, normal: Vec3) => void;

type Registry = {
  bodies: Map<string, { viroTag: () => string; onCollision: () => BodyCollisionHandler | undefined }>;
  listeners: Set<(collision: ViroCollision) => void>;
  installed: boolean;
};

const registries = new WeakMap<ViroSceneApi, Registry>();
let nextKey = 0;

function registryFor(scene: ViroSceneApi): Registry {
  let r = registries.get(scene);
  if (!r) {
    r = { bodies: new Map(), listeners: new Set(), installed: false };
    registries.set(scene, r);
  }
  if (!r.installed) {
    const reg = r;
    reg.installed = scene.setCollisionHandler((c) => {
      const self = reg.bodies.get(c.tag);
      const other = reg.bodies.get(c.otherTag);
      const tag = self ? self.viroTag() : c.tag;
      const otherTag = other ? other.viroTag() : c.otherTag;
      self?.onCollision()?.(otherTag, c.point, c.normal);
      for (const l of reg.listeners) l({ tag, otherTag, point: c.point, normal: c.normal });
    });
  }
  return r;
}

/** A unique renderer tag for one node's body; getters so later prop changes count. */
export function registerCollisionBody(
  scene: ViroSceneApi,
  viroTag: () => string,
  onCollision: () => BodyCollisionHandler | undefined,
): { key: string; unregister(): void } {
  const key = `viro-web-body-${++nextKey}`;
  const r = registryFor(scene);
  r.bodies.set(key, { viroTag, onCollision });
  return { key, unregister: () => r.bodies.delete(key) };
}

/** Every collision in the scene, by viroTag. Returns the unsubscribe. */
export function addCollisionListener(scene: ViroSceneApi, listener: (collision: ViroCollision) => void): () => void {
  const r = registryFor(scene);
  r.listeners.add(listener);
  return () => r.listeners.delete(listener);
}
