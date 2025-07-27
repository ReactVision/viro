/**
 * ViroQuad
 *
 * A component for rendering a 2D quad in 3D space.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  useViroEventListeners,
  convertCommonProps,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroQuadProps extends ViroCommonProps {
  // Quad properties
  width?: number;
  height?: number;

  // UV coordinates
  uvCoordinates?: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];

  // Materials
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  arShadowReceiver?: boolean;
}

/**
 * ViroQuad is a component for rendering a 2D quad in 3D space.
 * It's a flat rectangular surface that can be used for various purposes,
 * such as displaying images, videos, or creating simple geometric shapes.
 */
export const ViroQuad: React.FC<ViroQuadProps> = (props) => {
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
  const nodeId = useViroNode("quad", nativeProps);

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

  // Quad doesn't have children, so just return null
  return null;
};
