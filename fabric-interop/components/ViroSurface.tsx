/**
 * ViroSurface
 *
 * A component for rendering a flat surface in 3D space.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  convertCommonProps,
  useViroEventListeners,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSurfaceProps extends ViroCommonProps {
  // Surface properties
  width?: number;
  height?: number;
  uvCoordinates?: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];

  // Visual properties
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  arShadowReceiver?: boolean;
}

/**
 * ViroSurface is a component for rendering a flat surface in 3D space.
 * It's similar to ViroQuad but with additional properties for more flexibility.
 */
export const ViroSurface: React.FC<ViroSurfaceProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    width: props.width ?? 1,
    height: props.height ?? 1,
    uvCoordinates: props.uvCoordinates,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    arShadowReceiver: props.arShadowReceiver,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("surface", nativeProps);

  
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
