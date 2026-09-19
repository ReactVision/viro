/**
 * Web implementation of ViroCamera. Creates a node with a camera, positions it
 * via the shared node hook, and (when active) makes it the renderer's point of
 * view. Defaults to active unless `active={false}`.
 */
import * as React from "react";
import { useEffect } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  active?: boolean;
  projection?: "perspective" | "orthographic";
  orthographicScale?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroCamera(props: Props) {
  const node = useViroNode(props);
  const scene = useViroScene();
  const active = props.active !== false;
  const { projection, orthographicScale } = props;

  useEffect(() => {
    scene.setNodeCamera(node);
  }, [scene, node]);

  useEffect(() => {
    if (active) scene.setActiveCameraNode(node);
  }, [scene, node, active]);

  // Order matters only in that the camera must exist first, which the effect
  // above guarantees — effects run in declaration order.
  useEffect(() => {
    scene.setCameraProjection(node, projection ?? "perspective");
  }, [scene, node, projection]);

  useEffect(() => {
    if (orthographicScale !== undefined) {
      scene.setCameraOrthographicScale(node, orthographicScale);
    }
  }, [scene, node, orthographicScale]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
