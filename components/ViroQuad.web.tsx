/**
 * Web implementation of ViroQuad — a node with a flat quad geometry (same
 * underlying surface as ViroSurface). Dimensions are read on mount.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  width?: number;
  height?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroQuad(props: Props) {
  // Inside a ViroFlexView the layout decides the size, as it does natively.
  const slot = useViroFlexSlot();
  const width = slot?.width ?? props.width ?? 1;
  const height = slot?.height ?? props.height ?? 1;
  const node = useViroNode(props, (scene) => scene.createSurface(width, height));
  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
