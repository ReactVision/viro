/**
 * ViroSpotLight
 *
 * A component for adding spot lighting to a scene.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSpotLightProps extends ViroCommonProps {
  // Light properties
  color?: string;
  intensity?: number;
  temperature?: number;
  direction?: [number, number, number];
  innerAngle?: number;
  outerAngle?: number;
  attenuationStartDistance?: number;
  attenuationEndDistance?: number;
  influenceBitMask?: number;

  // Shadow properties
  castsShadow?: boolean;
  shadowOpacity?: number;
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNearZ?: number;
  shadowFarZ?: number;
}

/**
 * ViroSpotLight is a component for adding spot lighting to a scene.
 * Spot light is a type of light that illuminates objects in a cone-shaped area,
 * similar to a flashlight or stage spotlight.
 */
export const ViroSpotLight: React.FC<ViroSpotLightProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    color: props.color,
    intensity: props.intensity,
    temperature: props.temperature,
    direction: props.direction,
    innerAngle: props.innerAngle,
    outerAngle: props.outerAngle,
    attenuationStartDistance: props.attenuationStartDistance,
    attenuationEndDistance: props.attenuationEndDistance,
    influenceBitMask: props.influenceBitMask,
    castsShadow: props.castsShadow,
    shadowOpacity: props.shadowOpacity,
    shadowMapSize: props.shadowMapSize,
    shadowBias: props.shadowBias,
    shadowNearZ: props.shadowNearZ,
    shadowFarZ: props.shadowFarZ,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("spotLight", nativeProps);
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
