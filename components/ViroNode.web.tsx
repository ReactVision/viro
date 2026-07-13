/**
 * Web implementation of ViroNode — a transform group with no geometry. Creates a
 * native node, applies transform props, and provides its handle as the parent
 * for its children.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & { children?: React.ReactNode; [key: string]: any };

export function ViroNode(props: Props) {
  const node = useViroNode(props);
  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
