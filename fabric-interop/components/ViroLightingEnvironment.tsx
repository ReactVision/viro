/**
 * ViroLightingEnvironment
 *
 * A component for setting up environment-based lighting using HDR images.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroLightingEnvironmentProps extends ViroCommonProps {
  // Environment source
  source: { uri: string } | number;

  // Lighting properties
  intensity?: number;
  rotation?: [number, number, number];
}

/**
 * ViroLightingEnvironment is a component for setting up environment-based lighting using HDR images.
 * It provides realistic lighting and reflections based on a 360-degree HDR environment map.
 */
export const ViroLightingEnvironment: React.FC<ViroLightingEnvironmentProps> = (
  props
) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    source: props.source,
    intensity: props.intensity,
    rotation: props.rotation,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("lightingEnvironment", nativeProps);
  // Register event handlers using our new event system
  useViroEventListeners(nodeId, {
    onHover: props.onHover,
    onClick: props.onClick,
    onClickState: props.onClickState,
    onTouch: props.onTouch,
    onScroll: props.onScroll,
    onSwipe: props.onSwipe,
    onDrag: props.onDrag,
    onPinch: props.onPinch,
    onRotate: props.onRotate,
    onFuse:
      typeof props.onFuse === "function"
        ? props.onFuse
        : props.onFuse?.callback,
    onCollision: props.onCollision,
    onTransformUpdate: props.onTransformUpdate,
  });

  // Component doesn't have children, so just return null
  return null;
};
