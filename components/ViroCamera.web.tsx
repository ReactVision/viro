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
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroCamera(props: Props) {
  const node = useViroNode(props);
  const scene = useViroScene();
  const active = props.active !== false;

  useEffect(() => {
    scene.setNodeCamera(node);
  }, [scene, node]);

  useEffect(() => {
    if (active) scene.setActiveCameraNode(node);
  }, [scene, node, active]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
