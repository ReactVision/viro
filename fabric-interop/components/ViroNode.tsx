/**
 * ViroNode
 *
 * A component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */

import React, { useContext } from "react";
import {
  ViroContextProvider,
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroNodeProps extends ViroCommonProps {
  // Node-specific props
  renderingOrder?: number;
  viroTag?: string;
  physicsBody?: {
    type: "Dynamic" | "Kinematic" | "Static";
    mass?: number;
    restitution?: number;
    shape?: {
      type: "Box" | "Sphere" | "Compound";
      params?: number[];
    };
    friction?: number;
    useGravity?: boolean;
    enabled?: boolean;
    velocity?: [number, number, number];
    force?: {
      value: [number, number, number];
      position: [number, number, number];
    };
    torque?: [number, number, number];
  };

  // Children components
  children?: React.ReactNode;
}

/**
 * ViroNode is a component that serves as a container for other Viro components.
 * It doesn't render anything itself but provides a coordinate system for its children.
 */
export const ViroNode: React.FC<ViroNodeProps> = (props) => {
  // Parent will be determined by context automatically

  // Convert common props to the format expected by the native code
  const nativeProps = convertCommonProps(props);

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("node", nativeProps);

  // Render children with this node as their parent
  return (
    <ViroContextProvider value={nodeId}>{props.children}</ViroContextProvider>
  );
};
