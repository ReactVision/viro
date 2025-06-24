/**
 * ViroOmniLight
 *
 * A component for adding omnidirectional lighting to a scene.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroOmniLightProps extends ViroCommonProps {
  // Light properties
  color?: string;
  intensity?: number;
  temperature?: number;
  attenuationStartDistance?: number;
  attenuationEndDistance?: number;
  influenceBitMask?: number;
}

/**
 * ViroOmniLight is a component for adding omnidirectional lighting to a scene.
 * Omni light is a type of light that illuminates objects in all directions
 * from a single point, similar to a light bulb.
 */
export const ViroOmniLight: React.FC<ViroOmniLightProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    color: props.color,
    intensity: props.intensity,
    temperature: props.temperature,
    attenuationStartDistance: props.attenuationStartDistance,
    attenuationEndDistance: props.attenuationEndDistance,
    influenceBitMask: props.influenceBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("omniLight", nativeProps);

  // Omni light doesn't have children, so just return null
  return null;
};
