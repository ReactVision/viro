/**
 * Web implementation of ViroBox: a node with box geometry, rebuilt when a
 * dimension changes, as native's setters do.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  width?: number;
  height?: number;
  length?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroBox(props: Props) {
  const width = props.width ?? 1;
  const height = props.height ?? 1;
  const length = props.length ?? 1;

  const node = useViroNode(
    props,
    (scene) => scene.createBox(width, height, length),
    true,
    `${width}x${height}x${length}`,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
