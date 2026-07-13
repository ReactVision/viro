/**
 * Web implementation of ViroSphere — a node with sphere geometry.
 * Segment counts use the renderer default; radius is read on mount.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  radius?: number;
  widthSegmentCount?: number;
  heightSegmentCount?: number;
  facesOutward?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroSphere(props: Props) {
  const radius = props.radius ?? 1;
  const node = useViroNode(props, (scene) => scene.createSphere(radius));
  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
