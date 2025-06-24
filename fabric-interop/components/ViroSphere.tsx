/**
 * ViroSphere
 *
 * A 3D sphere component with customizable radius and materials.
 */

import React from "react";
import {
  ViroCommonProps,
  useViroNode,
  useViroEventListeners,
  convertCommonProps,
} from "./ViroUtils";
import { getNativeViro } from "./ViroGlobal";

export interface ViroSphereProps extends ViroCommonProps {
  // Sphere-specific props
  radius?: number;
  facesCount?: number;
  segmentCount?: number;
  widthSegmentCount?: number;
  heightSegmentCount?: number;
  materials?: string | string[];

  // Lighting props
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;

  // Physics props
  highAccuracyEvents?: boolean;
}

/**
 * ViroSphere is a 3D sphere component with customizable radius and materials.
 */
export const ViroSphere: React.FC<ViroSphereProps> = (props) => {
  // Convert common props to the format expected by the native code
  const nativeProps = {
    ...convertCommonProps(props),
    radius: props.radius ?? 1,
    facesCount: props.facesCount,
    segmentCount: props.segmentCount,
    widthSegmentCount: props.widthSegmentCount,
    heightSegmentCount: props.heightSegmentCount,
    materials: props.materials,
    lightReceivingBitMask: props.lightReceivingBitMask,
    shadowCastingBitMask: props.shadowCastingBitMask,
    highAccuracyEvents: props.highAccuracyEvents,
  };

  // Create the node (parent will be determined by context)
  const nodeId = useViroNode("sphere", nativeProps);

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

  // Sphere doesn't have children, so just return null
  return null;
};
