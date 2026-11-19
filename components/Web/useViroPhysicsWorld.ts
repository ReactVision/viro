/**
 * A scene's `physicsWorld`, shared by ViroScene.web and ViroARScene.web.
 *
 * On web a body joins the world only once the scene switches physics on
 * (VROSceneWeb.cpp keeps that switch so Studio can honour a scene with physics
 * off). Native creates the world on demand at -9.81 for any body, so a scene
 * switches it on whether or not it passes the prop. Studio's own scene sets the
 * switch after this, from its config, and so still decides.
 */
import { useEffect } from "react";
import { ViroPhysicsShapeType, type ViroSceneApi } from "@reactvision/viro-web-renderer";
import { useViroScene } from "./ViroWebContext";
import { resolveShape } from "./viroPhysicsBody";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

export type ViroPhysicsWorldProp = { gravity?: number[]; drawBounds?: boolean };

export function useViroPhysicsWorld(world: ViroPhysicsWorldProp | undefined): void {
  const scene = useViroScene();
  const g = world?.gravity;
  const gx = g?.[0] ?? 0;
  const gy = g?.[1] ?? -9.81;
  const gz = g?.[2] ?? 0;
  useEffect(() => {
    scene?.setPhysicsWorld(true, [gx, gy, gz]);
  }, [scene, gx, gy, gz]);
  const drawBounds = !!world?.drawBounds;
  useEffect(() => {
    if (!scene) return;
    const supported = typeof scene.setPhysicsDebugDraw === "function" && scene.setPhysicsDebugDraw(drawBounds);
    if (drawBounds && !supported) warnUnsupported("physicsWorld.drawBounds", "this version of the web renderer");
  }, [scene, drawBounds]);
}

type V3 = [number, number, number];

/** ViroScene's and ViroARScene's physics queries, shared by their web handles. */
export type ViroCollisionQueries = {
  findCollisionsWithRayAsync: (from: number[], to: number[], closest: boolean, viroTag: string) => Promise<boolean>;
  findCollisionsWithShapeAsync: (
    from: number[],
    to: number[],
    shapeString: string,
    shapeParam: number[],
    viroTag: string,
  ) => Promise<boolean>;
};

const point = (p: number[], name: string): V3 => {
  if (!Array.isArray(p) || p.length !== 3) throw new Error(`${name} must be [x, y, z]`);
  return [p[0], p[1], p[2]];
};

// True when anything was hit; each body hit gets onCollision with viroTag as
// the other party, as native reports it. A box takes half extents, as the
// physicsBody shape does.
export function collisionQueries(scene: ViroSceneApi): ViroCollisionQueries {
  const unsupported = () => {
    warnUnsupported("findCollisionsWithRayAsync and findCollisionsWithShapeAsync", "this version of the web renderer");
    return false;
  };
  return {
    findCollisionsWithRayAsync: async (from, to, closest, viroTag) => {
      if (typeof scene.findCollisionsWithRay !== "function") return unsupported();
      const hit = scene.findCollisionsWithRay(point(from, "from"), point(to, "to"), !!closest, viroTag ?? "");
      return hit ?? unsupported();
    },
    findCollisionsWithShapeAsync: async (from, to, shapeString, shapeParam, viroTag) => {
      if (typeof scene.findCollisionsWithShape !== "function") return unsupported();
      const shape = resolveShape({ type: shapeString, params: shapeParam });
      const valid =
        (shape.type === ViroPhysicsShapeType.Box && shape.params.length >= 3) ||
        (shape.type === ViroPhysicsShapeType.Sphere && shape.params.length >= 1);
      if (!valid) {
        throw new Error(`findCollisionsWithShapeAsync takes a Box [x, y, z] or a Sphere [radius], not "${shapeString}"`);
      }
      const hit = scene.findCollisionsWithShape(
        point(from, "from"),
        point(to, "to"),
        shape.type,
        shape.params,
        viroTag ?? "",
      );
      return hit ?? unsupported();
    },
  };
}
