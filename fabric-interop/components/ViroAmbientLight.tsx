/**
 * ViroAmbientLight
 *
 * A component for adding ambient lighting to a scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";

export interface ViroAmbientLightProps extends ViroCommonProps {
  // Light properties
  color?: string;
  intensity?: number;
  temperature?: number;
  influenceBitMask?: number;
}

/**
 * ViroAmbientLight is a component for adding ambient lighting to a scene.
 * Ambient light is a type of light that illuminates all objects in the scene equally,
 * regardless of their position or orientation.
 */
export const ViroAmbientLight: React.FC<ViroAmbientLightProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    color: props.color,
    intensity: props.intensity,
    temperature: props.temperature,
    influenceBitMask: props.influenceBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("ambientLight", nativeProps);

  // Ambient light doesn't have children, so just return null
  return null;
};
