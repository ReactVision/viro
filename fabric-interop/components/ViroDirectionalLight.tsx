/**
 * ViroDirectionalLight
 *
 * A component for adding directional lighting to a scene.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroDirectionalLightProps extends ViroCommonProps {
  // Light properties
  color?: string;
  intensity?: number;
  temperature?: number;
  direction?: [number, number, number];
  influenceBitMask?: number;

  // Shadow properties
  castsShadow?: boolean;
  shadowOpacity?: number;
  shadowOrthographicSize?: number;
  shadowOrthographicPosition?: [number, number, number];
  shadowMapSize?: number;
  shadowBias?: number;
  shadowNearZ?: number;
  shadowFarZ?: number;
}

/**
 * ViroDirectionalLight is a component for adding directional lighting to a scene.
 * Directional light is a type of light that illuminates all objects in the scene
 * from a specific direction, similar to sunlight.
 */
export const ViroDirectionalLight: React.FC<ViroDirectionalLightProps> = (
  props
) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    color: props.color,
    intensity: props.intensity,
    temperature: props.temperature,
    direction: props.direction,
    influenceBitMask: props.influenceBitMask,
    castsShadow: props.castsShadow,
    shadowOpacity: props.shadowOpacity,
    shadowOrthographicSize: props.shadowOrthographicSize,
    shadowOrthographicPosition: props.shadowOrthographicPosition,
    shadowMapSize: props.shadowMapSize,
    shadowBias: props.shadowBias,
    shadowNearZ: props.shadowNearZ,
    shadowFarZ: props.shadowFarZ,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("directionalLight", nativeProps);
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
