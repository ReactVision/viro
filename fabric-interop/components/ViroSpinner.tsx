/**
 * ViroSpinner
 *
 * A component for displaying loading spinners in 3D space.
 */

import React from "react";
import { ViroCommonProps, useViroNode, convertCommonProps } from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSpinnerProps extends ViroCommonProps {
  // Spinner properties
  type?: "light" | "dark";
  size?: "small" | "large";

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;
}

/**
 * ViroSpinner is a component for displaying loading spinners in 3D space.
 * It provides visual feedback during loading operations.
 */
export const ViroSpinner: React.FC<ViroSpinnerProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    type: props.type,
    size: props.size,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("image", nativeProps);

  // Spinner doesn't have children, so just return null
  return null;
};
