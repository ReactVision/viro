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
import { useViroScene } from "./ViroWebContext";
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
  useEffect(() => {
    if (world?.drawBounds) warnUnsupported("physicsWorld.drawBounds", "the web");
  }, [world?.drawBounds]);
}
