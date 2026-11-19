/**
 * Web implementation of ViroScene. The scene root node is provided by the
 * navigator (Viro3DSceneNavigator.web), so ViroScene simply renders its children
 * under that root. Scene-level props (background, camera) are follow-ups.
 */
import * as React from "react";
import { forwardRef, useImperativeHandle } from "react";

import { useViroToneMapping } from "./Web/useViroToneMapping";
import { collisionQueries, useViroPhysicsWorld, type ViroCollisionQueries, type ViroPhysicsWorldProp } from "./Web/useViroPhysicsWorld";
import {
  cameraOrientationAsync,
  useViroCameraTransform,
  type ViroWebCameraOrientation,
  type ViroWebCameraTransform,
} from "./Web/viroCameraTransform";
import { useViroScene } from "./Web/ViroWebContext";
import { useViroSceneEvents } from "./Web/useViroNode";
import type { Vec3 } from "./Web/viroMath";

export type ViroSceneHandle = ViroCollisionQueries & {
  getCameraOrientationAsync: () => Promise<ViroWebCameraOrientation>;
  getCameraPositionAsync: () => Promise<Vec3>;
};

export const ViroScene = forwardRef<
  ViroSceneHandle,
  {
    children?: React.ReactNode;
    /** Off drops Hable's curve without dropping PBR — see useViroToneMapping. */
    toneMappingEnabled?: boolean;
    physicsWorld?: ViroPhysicsWorldProp;
    onCameraTransformUpdate?: (transform: ViroWebCameraTransform) => void;
    [key: string]: any;
  }
>(function ViroScene(props, ref) {
  const scene = useViroScene();
  useViroToneMapping(props.toneMappingEnabled);
  useViroPhysicsWorld(props.physicsWorld);
  useViroCameraTransform(props.onCameraTransformUpdate);
  useViroSceneEvents(props);
  useImperativeHandle(
    ref,
    () => ({
      getCameraOrientationAsync: () => cameraOrientationAsync(scene),
      getCameraPositionAsync: async () => (await cameraOrientationAsync(scene)).position,
      ...collisionQueries(scene),
    }),
    [scene],
  );
  return <>{props.children}</>;
});
