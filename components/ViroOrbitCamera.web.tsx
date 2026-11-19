/**
 * Web implementation of ViroOrbitCamera: a camera at `position` looking at
 * `focalPoint` (default the origin, as on native), expressed as an Euler
 * rotation with no roll. When `active`, becomes the renderer's point of view.
 */
import * as React from "react";
import { useEffect } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
import { activateSceneCamera, setSceneCameraOrthographic } from "./Web/viroDrag";
import { lookAtEulerDegrees } from "./Web/viroMath";

type Vec3 = [number, number, number];

type Props = ViroWebNodeProps & {
  active?: boolean;
  focalPoint?: Vec3;
  projection?: "perspective" | "orthographic";
  orthographicScale?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroOrbitCamera(props: Props) {
  const position = (props.position ?? [0, 0, 0]) as Vec3;
  const rotation = lookAtEulerDegrees(position, props.focalPoint ?? [0, 0, 0]);

  const node = useViroNode({ ...props, rotation });
  const scene = useViroScene();
  const active = props.active !== false;

  useEffect(() => {
    scene.setNodeCamera(node);
  }, [scene, node]);

  useEffect(() => (active ? activateSceneCamera(scene, node) : undefined), [scene, node, active]);

  useEffect(() => {
    scene.setCameraProjection(node, props.projection ?? "perspective");
    setSceneCameraOrthographic(scene, node, props.projection === "orthographic");
    return () => setSceneCameraOrthographic(scene, node, false);
  }, [scene, node, props.projection]);

  useEffect(() => {
    if (props.orthographicScale !== undefined) {
      scene.setCameraOrthographicScale(node, props.orthographicScale);
    }
  }, [scene, node, props.orthographicScale]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
